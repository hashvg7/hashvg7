from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import requests
from invoice_calculator import InvoiceCalculator, VARIABLE_SERVICES, FIXED_SERVICES, BUNDLES

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# =============== MODELS ===============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    role: str  # admin, customer, finance_team, accountant, sales, pm
    created_at: datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "customer"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Customer(BaseModel):
    customer_id: str
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    permissions: Dict[str, bool] = Field(default_factory=lambda: {
        "view_invoices": True,
        "view_reports": False,
        "make_payments": False,
        "view_subscriptions": True,
        "view_dashboard": True,
        "view_analytics": False
    })
    created_at: datetime

class CustomerCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    permissions: Optional[Dict[str, bool]] = None
    rate_card: Optional[Dict[str, float]] = None
    bundles: Optional[List[str]] = None
    minimum_balance: Optional[float] = 0
    account_status: Optional[str] = "active"

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    permissions: Optional[Dict[str, bool]] = None

class Subscription(BaseModel):
    subscription_id: str
    customer_id: str
    plan_name: str
    mrr: float
    status: str  # active, cancelled, expired
    start_date: datetime
    end_date: Optional[datetime] = None
    created_at: datetime

class SubscriptionCreate(BaseModel):
    customer_id: str
    plan_name: str
    mrr: float
    status: str = "active"

class Invoice(BaseModel):
    invoice_id: str
    customer_id: str
    amount: float
    status: str  # paid, pending, overdue
    items: List[Dict[str, Any]]
    due_date: datetime
    created_at: datetime

class InvoiceCreate(BaseModel):
    customer_id: str
    amount: float
    status: str = "pending"
    items: List[Dict[str, Any]]
    due_date: datetime

class Expense(BaseModel):
    expense_id: str
    category: str
    amount: float
    description: str
    date: datetime
    created_at: datetime

class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: str
    date: Optional[datetime] = None

class RateTier(BaseModel):
    tier_id: str
    service_type: str  # orders, users, warehouses, skus, etc
    tier_name: str
    range_min: int
    range_max: Optional[int] = None
    rate: float
    created_at: datetime

class RateTierCreate(BaseModel):
    service_type: str
    tier_name: str
    range_min: int
    range_max: Optional[int] = None
    rate: float

# =============== HELPER FUNCTIONS ===============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

async def get_current_user(request: Request) -> Optional[User]:
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return None
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    if isinstance(user_doc["created_at"], str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    return User(**user_doc)

def require_auth(user: Optional[User]):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_role(user: User, allowed_roles: List[str]):
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user

# =============== AUTH ROUTES ===============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(user_data.password)
    
    # Check if this is the first user - make them admin
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else user_data.role
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": role,
        "password_hash": hashed_pw,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    return {"message": "User registered successfully", "user_id": user_id, "role": role}

@api_router.post("/auth/login")
async def login(user_data: UserLogin, response: Response):
    user_doc = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    
    if not user_doc or not verify_password(user_data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    if isinstance(user_doc["created_at"], str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    user_response = User(**{k: v for k, v in user_doc.items() if k != "password_hash"})
    
    return {"user": user_response, "session_token": session_token}

@api_router.post("/auth/google")
async def google_auth(request: Request, response: Response):
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    try:
        google_response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        google_response.raise_for_status()
        google_data = google_response.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    email = google_data["email"]
    name = google_data["name"]
    
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user_doc:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "role": "customer",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    else:
        if user_doc.get("name") != name:
            await db.users.update_one(
                {"user_id": user_doc["user_id"]},
                {"$set": {"name": name}}
            )
            user_doc["name"] = name
    
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    if isinstance(user_doc["created_at"], str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    user_response = User(**{k: v for k, v in user_doc.items() if k != "password_hash"})
    
    return {"user": user_response, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# =============== CUSTOMER ROUTES ===============

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team", "sales"])
    
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    
    for customer in customers:
        if isinstance(customer["created_at"], str):
            customer["created_at"] = datetime.fromisoformat(customer["created_at"])
    
    return customers

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "sales"])
    
    customer_id = f"cust_{uuid.uuid4().hex[:12]}"
    
    customer_doc = {
        "customer_id": customer_id,
        "name": customer_data.name,
        "email": customer_data.email,
        "phone": customer_data.phone,
        "company": customer_data.company,
        "permissions": customer_data.permissions or {
            "view_invoices": True,
            "view_reports": False,
            "make_payments": False,
            "view_subscriptions": True,
            "view_dashboard": True,
            "view_analytics": False
        },
        "rate_card": customer_data.rate_card or {},
        "bundles": customer_data.bundles or [],
        "minimum_balance": customer_data.minimum_balance or 0,
        "account_status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.customers.insert_one(customer_doc)
    customer_doc["created_at"] = datetime.fromisoformat(customer_doc["created_at"])
    
    return Customer(**customer_doc)

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_data: CustomerUpdate, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "sales"])
    
    update_data = {k: v for k, v in customer_data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.customers.update_one(
        {"customer_id": customer_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer_doc = await db.customers.find_one({"customer_id": customer_id}, {"_id": 0})
    if isinstance(customer_doc["created_at"], str):
        customer_doc["created_at"] = datetime.fromisoformat(customer_doc["created_at"])
    
    return Customer(**customer_doc)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin"])
    
    result = await db.customers.delete_one({"customer_id": customer_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"message": "Customer deleted successfully"}

# =============== SUBSCRIPTION ROUTES ===============

@api_router.get("/subscriptions", response_model=List[Subscription])
async def get_subscriptions(request: Request):
    user = require_auth(await get_current_user(request))
    
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(1000)
    
    for sub in subscriptions:
        if isinstance(sub["created_at"], str):
            sub["created_at"] = datetime.fromisoformat(sub["created_at"])
        if isinstance(sub["start_date"], str):
            sub["start_date"] = datetime.fromisoformat(sub["start_date"])
        if sub.get("end_date") and isinstance(sub["end_date"], str):
            sub["end_date"] = datetime.fromisoformat(sub["end_date"])
    
    return subscriptions

@api_router.post("/subscriptions", response_model=Subscription)
async def create_subscription(sub_data: SubscriptionCreate, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team", "sales"])
    
    subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
    
    sub_doc = {
        "subscription_id": subscription_id,
        "customer_id": sub_data.customer_id,
        "plan_name": sub_data.plan_name,
        "mrr": sub_data.mrr,
        "status": sub_data.status,
        "start_date": datetime.now(timezone.utc).isoformat(),
        "end_date": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.subscriptions.insert_one(sub_doc)
    sub_doc["created_at"] = datetime.fromisoformat(sub_doc["created_at"])
    sub_doc["start_date"] = datetime.fromisoformat(sub_doc["start_date"])
    
    return Subscription(**sub_doc)

# =============== INVOICE ROUTES ===============

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(request: Request):
    user = require_auth(await get_current_user(request))
    
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    
    for invoice in invoices:
        if isinstance(invoice["created_at"], str):
            invoice["created_at"] = datetime.fromisoformat(invoice["created_at"])
        if isinstance(invoice["due_date"], str):
            invoice["due_date"] = datetime.fromisoformat(invoice["due_date"])
    
    return invoices

@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice_data: InvoiceCreate, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    
    invoice_doc = {
        "invoice_id": invoice_id,
        "customer_id": invoice_data.customer_id,
        "amount": invoice_data.amount,
        "status": invoice_data.status,
        "items": invoice_data.items,
        "due_date": invoice_data.due_date.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.insert_one(invoice_doc)
    invoice_doc["created_at"] = datetime.fromisoformat(invoice_doc["created_at"])
    invoice_doc["due_date"] = datetime.fromisoformat(invoice_doc["due_date"])
    
    return Invoice(**invoice_doc)

# =============== EXPENSE ROUTES ===============

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team", "accountant"])
    
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
    
    for expense in expenses:
        if isinstance(expense["created_at"], str):
            expense["created_at"] = datetime.fromisoformat(expense["created_at"])
        if isinstance(expense["date"], str):
            expense["date"] = datetime.fromisoformat(expense["date"])
    
    return expenses

@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseCreate, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team", "accountant"])
    
    expense_id = f"exp_{uuid.uuid4().hex[:12]}"
    
    expense_doc = {
        "expense_id": expense_id,
        "category": expense_data.category,
        "amount": expense_data.amount,
        "description": expense_data.description,
        "date": (expense_data.date or datetime.now(timezone.utc)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.expenses.insert_one(expense_doc)
    expense_doc["created_at"] = datetime.fromisoformat(expense_doc["created_at"])
    expense_doc["date"] = datetime.fromisoformat(expense_doc["date"])
    
    return Expense(**expense_doc)

# =============== RATE TIER ROUTES ===============

@api_router.get("/rate-tiers", response_model=List[RateTier])
async def get_rate_tiers(request: Request):
    user = require_auth(await get_current_user(request))
    
    tiers = await db.rate_tiers.find({}, {"_id": 0}).to_list(1000)
    
    for tier in tiers:
        if isinstance(tier["created_at"], str):
            tier["created_at"] = datetime.fromisoformat(tier["created_at"])
    
    return tiers

@api_router.post("/rate-tiers", response_model=RateTier)
async def create_rate_tier(tier_data: RateTierCreate, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    tier_id = f"tier_{uuid.uuid4().hex[:12]}"
    
    tier_doc = {
        "tier_id": tier_id,
        "service_type": tier_data.service_type,
        "tier_name": tier_data.tier_name,
        "range_min": tier_data.range_min,
        "range_max": tier_data.range_max,
        "rate": tier_data.rate,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rate_tiers.insert_one(tier_doc)
    tier_doc["created_at"] = datetime.fromisoformat(tier_doc["created_at"])
    
    return RateTier(**tier_doc)

# =============== USAGE TRACKING ROUTES ===============


# =============== USAGE TRACKING ROUTES ===============

class UsageLog(BaseModel):
    log_id: str
    customer_id: str
    service: str
    count: int
    year: int
    month: int
    logged_at: datetime

class UsageLogCreate(BaseModel):
    customer_id: str
    service: str
    count: int
    year: Optional[int] = None
    month: Optional[int] = None

@api_router.post("/usage-logs", response_model=UsageLog)
async def log_usage(usage_data: UsageLogCreate, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    now = datetime.now(timezone.utc)
    log_id = f"log_{uuid.uuid4().hex[:12]}"
    
    log_doc = {
        "log_id": log_id,
        "customer_id": usage_data.customer_id,
        "service": usage_data.service,
        "count": usage_data.count,
        "year": usage_data.year or now.year,
        "month": usage_data.month or now.month,
        "logged_at": now.isoformat()
    }
    
    await db.usage_logs.insert_one(log_doc)
    log_doc["logged_at"] = now
    
    return UsageLog(**log_doc)

@api_router.get("/usage-logs/{customer_id}")
async def get_usage_logs(customer_id: str, year: int, month: int, request: Request):
    user = require_auth(await get_current_user(request))
    
    logs = await db.usage_logs.find(
        {"customer_id": customer_id, "year": year, "month": month},
        {"_id": 0}
    ).to_list(1000)
    
    return logs

# =============== INVOICE GENERATION ROUTES ===============

@api_router.post("/invoices/generate-monthly")
async def generate_monthly_invoice(
    customer_id: str,
    year: int,
    month: int,
    request: Request
):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    existing = await db.invoices.find_one({
        "customer_id": customer_id,
        "invoice_period": f"{year}-{month:02d}"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Invoice already exists for this period")
    
    calculator = InvoiceCalculator(db)
    invoice_data = await calculator.calculate_monthly_invoice(customer_id, year, month)
    
    customer = await db.customers.find_one({"customer_id": customer_id}, {"_id": 0})
    bundles = customer.get("bundles", [])
    
    roi_analysis = calculator.calculate_roi_by_product(invoice_data, bundles)
    
    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    invoice_doc = {
        "invoice_id": invoice_id,
        "customer_id": customer_id,
        "amount": invoice_data["total"],
        "status": "pending",
        "items": invoice_data["items"],
        "subtotal": invoice_data["subtotal"],
        "tax_rate": invoice_data["tax_rate"],
        "tax_amount": invoice_data["tax_amount"],
        "invoice_period": invoice_data["invoice_period"],
        "due_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "roi_breakdown": invoice_data["roi_breakdown"],
        "roi_analysis": roi_analysis,
        "usage_data": invoice_data["usage_data"],
        "paid_amount": 0,
        "payment_history": []
    }
    
    await db.invoices.insert_one(invoice_doc)
    
    return {"message": "Invoice generated successfully", "invoice_id": invoice_id, "invoice": invoice_doc}

# =============== PAYMENT MANAGEMENT ROUTES ===============

class PaymentRecord(BaseModel):
    amount: float
    payment_method: str
    payment_reference: Optional[str] = None
    notes: Optional[str] = None

@api_router.post("/invoices/{invoice_id}/record-payment")
async def record_payment(
    invoice_id: str,
    payment: PaymentRecord,
    request: Request
):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    current_paid = invoice.get("paid_amount", 0)
    new_paid_amount = current_paid + payment.amount
    
    payment_history = invoice.get("payment_history", [])
    payment_history.append({
        "amount": payment.amount,
        "payment_method": payment.payment_method,
        "payment_reference": payment.payment_reference,
        "notes": payment.notes,
        "payment_date": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user.user_id
    })
    
    total_amount = invoice["amount"]
    if new_paid_amount >= total_amount:
        new_status = "paid"
    elif new_paid_amount > 0:
        new_status = "partially_paid"
    else:
        new_status = "pending"
    
    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {
            "paid_amount": new_paid_amount,
            "payment_history": payment_history,
            "status": new_status,
            "last_payment_date": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if new_status == "paid":
        await db.customers.update_one(
            {"customer_id": invoice["customer_id"]},
            {"$set": {"account_status": "active"}}
        )
    
    return {
        "message": "Payment recorded successfully",
        "paid_amount": new_paid_amount,
        "remaining_amount": max(0, total_amount - new_paid_amount),
        "status": new_status
    }

# =============== ACCOUNT MANAGEMENT ROUTES ===============

@api_router.post("/customers/{customer_id}/suspend-account")
async def suspend_account(customer_id: str, reason: str, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin"])
    
    result = await db.customers.update_one(
        {"customer_id": customer_id},
        {"$set": {
            "account_status": "suspended",
            "suspension_reason": reason,
            "suspended_at": datetime.now(timezone.utc).isoformat(),
            "suspended_by": user.user_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"message": "Account suspended successfully"}

@api_router.post("/customers/{customer_id}/shutdown-account")
async def shutdown_account(customer_id: str, reason: str, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin"])
    
    result = await db.customers.update_one(
        {"customer_id": customer_id},
        {"$set": {
            "account_status": "shutdown",
            "shutdown_reason": reason,
            "shutdown_at": datetime.now(timezone.utc).isoformat(),
            "shutdown_by": user.user_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"message": "Account shutdown successfully"}

@api_router.post("/customers/{customer_id}/reactivate-account")
async def reactivate_account(customer_id: str, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin"])
    
    result = await db.customers.update_one(
        {"customer_id": customer_id},
        {"$set": {
            "account_status": "active",
            "reactivated_at": datetime.now(timezone.utc).isoformat(),
            "reactivated_by": user.user_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return {"message": "Account reactivated successfully"}

# =============== ROI CALCULATION ROUTES ===============

@api_router.get("/analytics/roi-by-product")
async def get_roi_by_product(
    customer_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    request: Request = None
):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team", "pm"])
    
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if year and month:
        query["invoice_period"] = f"{year}-{month:02d}"
    
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(1000)
    
    product_roi = {}
    
    for invoice in invoices:
        roi_analysis = invoice.get("roi_analysis", {})
        
        for product, data in roi_analysis.items():
            if product not in product_roi:
                product_roi[product] = {
                    "total_revenue": 0,
                    "total_usage": 0,
                    "weighted_roi": 0,
                    "invoice_count": 0
                }
            
            product_roi[product]["total_revenue"] += data.get("revenue", 0)
            product_roi[product]["total_usage"] += data.get("usage", 0)
            product_roi[product]["weighted_roi"] += data.get("weighted_roi_contribution", 0)
            product_roi[product]["invoice_count"] += 1
    
    return {
        "product_roi": product_roi,
        "filters": {
            "customer_id": customer_id,
            "year": year,
            "month": month
        }
    }

@api_router.get("/services/available")
async def get_available_services(request: Request):
    user = require_auth(await get_current_user(request))
    
    return {
        "variable_services": VARIABLE_SERVICES,
        "fixed_services": FIXED_SERVICES,
        "bundles": BUNDLES
    }


# =============== RECEIVABLES & PAYMENT ROUTES ===============

@api_router.get("/receivables")
async def get_receivables(request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team", "accountant"])
    
    pending_invoices = await db.invoices.find(
        {"status": {"$in": ["pending", "overdue"]}},
        {"_id": 0}
    ).to_list(1000)
    
    receivables_by_customer = {}
    for invoice in pending_invoices:
        customer_id = invoice["customer_id"]
        if customer_id not in receivables_by_customer:
            customer = await db.customers.find_one(
                {"customer_id": customer_id},
                {"_id": 0}
            )
            if customer:
                receivables_by_customer[customer_id] = {
                    "customer": customer,
                    "invoices": [],
                    "total_amount": 0
                }
        
        if customer_id in receivables_by_customer:
            if isinstance(invoice["created_at"], str):
                invoice["created_at"] = datetime.fromisoformat(invoice["created_at"])
            if isinstance(invoice["due_date"], str):
                invoice["due_date"] = datetime.fromisoformat(invoice["due_date"])
            
            receivables_by_customer[customer_id]["invoices"].append(invoice)
            receivables_by_customer[customer_id]["total_amount"] += invoice["amount"]
    
    return list(receivables_by_customer.values())

@api_router.post("/receivables/create-payment-link")
async def create_payment_link(invoice_id: str, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    customer = await db.customers.find_one(
        {"customer_id": invoice["customer_id"]},
        {"_id": 0}
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    try:
        import razorpay
        razorpay_key = os.environ.get('RAZORPAY_KEY_ID', 'rzp_test_key')
        razorpay_secret = os.environ.get('RAZORPAY_KEY_SECRET', 'secret')
        
        client = razorpay.Client(auth=(razorpay_key, razorpay_secret))
        
        amount_in_paise = int(invoice["amount"] * 100)
        payment_link = client.payment_link.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "description": f"Payment for Invoice {invoice['invoice_id']}",
            "customer": {
                "name": customer["name"],
                "email": customer["email"]
            }
        })
        
        await db.invoices.update_one(
            {"invoice_id": invoice_id},
            {"$set": {
                "payment_link_id": payment_link["id"],
                "payment_link_url": payment_link["short_url"],
                "payment_link_created_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "payment_link_id": payment_link["id"],
            "payment_link_url": payment_link["short_url"],
            "amount": invoice["amount"],
            "invoice_id": invoice_id
        }
        
    except Exception as e:
        logger.error(f"Error creating Razorpay payment link: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create payment link: {str(e)}")

@api_router.post("/receivables/send-payment-email")
async def send_payment_email(invoice_id: str, request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if not invoice.get("payment_link_url"):
        raise HTTPException(status_code=400, detail="Payment link not created yet")
    
    return {"status": "success", "message": "Email feature - integrate AWS SES"}

@api_router.post("/receivables/mark-paid")
async def mark_invoice_paid(invoice_id: str, payment_id: Optional[str] = None, request: Request = None):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    result = await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {
            "status": "paid",
            "payment_received_at": datetime.now(timezone.utc).isoformat(),
            "razorpay_payment_id": payment_id
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {
        "status": "success",
        "message": "Invoice marked as paid",
        "invoice_id": invoice_id,
        "payment_id": payment_id
    }

# Include the router in the main app

# =============== ANALYTICS ROUTES (MUST BE BEFORE app.include_router) ===============

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    user = require_auth(await get_current_user(request))
    
    total_customers = await db.customers.count_documents({})
    total_subscriptions = await db.subscriptions.count_documents({"status": "active"})
    
    subscriptions = await db.subscriptions.find({"status": "active"}, {"_id": 0}).to_list(1000)
    total_mrr = sum(sub.get("mrr", 0) for sub in subscriptions)
    
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    total_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "paid")
    pending_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "pending")
    
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
    total_expenses = sum(exp.get("amount", 0) for exp in expenses)
    
    return {
        "total_customers": total_customers,
        "total_subscriptions": total_subscriptions,
        "total_mrr": total_mrr,
        "total_revenue": total_revenue,
        "pending_revenue": pending_revenue,
        "total_expenses": total_expenses,
        "net_profit": total_revenue - total_expenses
    }

@api_router.get("/analytics/revenue-chart")
async def get_revenue_chart(request: Request):
    user = require_auth(await get_current_user(request))
    
    invoices = await db.invoices.find({"status": "paid"}, {"_id": 0}).to_list(1000)
    
    revenue_by_month = {}
    for invoice in invoices:
        created_at = invoice.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        month_key = created_at.strftime("%Y-%m")
        revenue_by_month[month_key] = revenue_by_month.get(month_key, 0) + invoice.get("amount", 0)
    
    chart_data = [{"month": k, "revenue": v} for k, v in sorted(revenue_by_month.items())]
    
    return chart_data

@api_router.get("/reminders/check-pending-invoices")
async def check_pending_invoices(request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    now = datetime.now(timezone.utc)
    
    overdue_invoices = await db.invoices.find({
        "status": {"$in": ["pending", "partially_paid"]},
        "due_date": {"$lt": now.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    actions_needed = []
    
    for invoice in overdue_invoices:
        customer = await db.customers.find_one(
            {"customer_id": invoice["customer_id"]},
            {"_id": 0}
        )
        
        if not customer:
            continue
        
        due_date = datetime.fromisoformat(invoice["due_date"])
        days_overdue = (now - due_date).days
        
        remaining_amount = invoice["amount"] - invoice.get("paid_amount", 0)
        
        action = {
            "customer_id": invoice["customer_id"],
            "customer_name": customer["name"],
            "invoice_id": invoice["invoice_id"],
            "amount_due": remaining_amount,
            "days_overdue": days_overdue,
            "account_status": customer.get("account_status", "active")
        }
        
        if days_overdue >= 30 and customer.get("account_status") != "shutdown":
            action["recommended_action"] = "shutdown_account"
            action["reason"] = f"Payment overdue by {days_overdue} days"
        elif days_overdue >= 15 and customer.get("account_status") == "active":
            action["recommended_action"] = "suspend_account"
            action["reason"] = f"Payment overdue by {days_overdue} days"
        elif days_overdue >= 7:
            action["recommended_action"] = "send_final_reminder"
        elif days_overdue >= 3:
            action["recommended_action"] = "send_reminder"
        else:
            action["recommended_action"] = "monitor"
        
        actions_needed.append(action)
    
    return {
        "total_overdue": len(overdue_invoices),
        "actions_needed": actions_needed,
        "checked_at": now.isoformat()
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

