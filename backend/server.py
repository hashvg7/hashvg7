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

# =============== RECEIVABLES & PAYMENT ROUTES ===============

@api_router.get("/receivables")
async def get_receivables(request: Request):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team", "accountant"])
    
    # Get all pending and overdue invoices
    pending_invoices = await db.invoices.find(
        {"status": {"$in": ["pending", "overdue"]}},
        {"_id": 0}
    ).to_list(1000)
    
    # Group by customer
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
async def create_payment_link(
    invoice_id: str,
    request: Request
):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    # Get invoice
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get customer
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
        
        # Create payment link
        amount_in_paise = int(invoice["amount"] * 100)
        payment_link = client.payment_link.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "description": f"Payment for Invoice {invoice['invoice_id']}",
            "customer": {
                "name": customer["name"],
                "email": customer["email"]
            },
            "notify": {
                "sms": False,
                "email": False  # We'll send our own email
            },
            "callback_url": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/payment-success",
            "callback_method": "get"
        })
        
        # Store payment link in invoice
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
async def send_payment_email(
    invoice_id: str,
    request: Request
):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    # Get invoice
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get customer
    customer = await db.customers.find_one(
        {"customer_id": invoice["customer_id"]},
        {"_id": 0}
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check if payment link exists
    if not invoice.get("payment_link_url"):
        raise HTTPException(status_code=400, detail="Payment link not created yet")
    
    try:
        import boto3
        from botocore.exceptions import ClientError
        
        aws_access_key = os.environ.get('AWS_ACCESS_KEY_ID')
        aws_secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
        aws_region = os.environ.get('AWS_REGION', 'us-east-1')
        sender_email = os.environ.get('AWS_SES_SENDER_EMAIL', 'noreply@finance.com')
        
        if not aws_access_key or not aws_secret_key:
            raise HTTPException(status_code=500, detail="AWS SES credentials not configured")
        
        ses_client = boto3.client(
            'ses',
            region_name=aws_region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key
        )
        
        # Create email content
        subject = f"Payment Request - Invoice {invoice['invoice_id']}"
        
        # Build invoice items HTML
        items_html = ""
        for item in invoice.get("items", []):
            items_html += f"""
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">{item['description']}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹{item['amount']:.2f}</td>
                </tr>
            """
        
        due_date_str = ""
        if isinstance(invoice.get("due_date"), str):
            due_date = datetime.fromisoformat(invoice["due_date"])
            due_date_str = due_date.strftime("%B %d, %Y")
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; color: #333; line-height: 1.6; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #064E3B; color: white; padding: 20px; text-align: center; }}
                .content {{ background-color: #f9f9f9; padding: 20px; }}
                .invoice-details {{ background-color: white; padding: 20px; margin: 20px 0; }}
                table {{ width: 100%; border-collapse: collapse; }}
                .total {{ font-size: 18px; font-weight: bold; margin-top: 20px; }}
                .payment-button {{ 
                    display: inline-block;
                    background-color: #064E3B;
                    color: white;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-weight: bold;
                }}
                .footer {{ text-align: center; color: #666; font-size: 12px; padding: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Payment Request</h1>
                </div>
                
                <div class="content">
                    <p>Dear {customer['name']},</p>
                    
                    <p>We hope this email finds you well. This is a friendly reminder that the following invoice is due for payment:</p>
                    
                    <div class="invoice-details">
                        <h2>Invoice Details</h2>
                        <p><strong>Invoice Number:</strong> {invoice['invoice_id']}</p>
                        <p><strong>Due Date:</strong> {due_date_str}</p>
                        
                        <table style="margin-top: 20px;">
                            <thead>
                                <tr style="background-color: #f0f0f0;">
                                    <th style="padding: 10px; text-align: left;">Description</th>
                                    <th style="padding: 10px; text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items_html}
                            </tbody>
                        </table>
                        
                        <div class="total">
                            <p style="text-align: right;">Total Amount Due: ₹{invoice['amount']:.2f}</p>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <p>Please click the button below to make your payment securely:</p>
                        <a href="{invoice['payment_link_url']}" class="payment-button">Pay Now</a>
                        <p style="margin-top: 10px; font-size: 12px; color: #666;">
                            Or copy this link: {invoice['payment_link_url']}
                        </p>
                    </div>
                    
                    <p>If you have already made this payment, please disregard this email.</p>
                    
                    <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
                    
                    <p>Best regards,<br>Finance Team</p>
                </div>
                
                <div class="footer">
                    <p>This is an automated email. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Dear {customer['name']},

        This is a payment request for Invoice {invoice['invoice_id']}.
        
        Amount Due: ₹{invoice['amount']:.2f}
        Due Date: {due_date_str}
        
        To make your payment, please visit: {invoice['payment_link_url']}
        
        If you have any questions, please contact us.
        
        Best regards,
        Finance Team
        """
        
        # Send email
        response = ses_client.send_email(
            Source=sender_email,
            Destination={'ToAddresses': [customer['email']]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'},
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'}
                }
            }
        )
        
        # Update invoice with email sent status
        await db.invoices.update_one(
            {"invoice_id": invoice_id},
            {"$set": {
                "payment_email_sent": True,
                "payment_email_sent_at": datetime.now(timezone.utc).isoformat(),
                "email_message_id": response['MessageId']
            }}
        )
        
        return {
            "status": "success",
            "message": "Payment email sent successfully",
            "message_id": response['MessageId'],
            "recipient": customer['email']
        }
        
    except ClientError as e:
        logger.error(f"AWS SES Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
    except Exception as e:
        logger.error(f"Error sending payment email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send payment email: {str(e)}")

@api_router.post("/receivables/mark-paid")
async def mark_invoice_paid(
    invoice_id: str,
    payment_id: Optional[str] = None,
    request: Request = None
):
    user = require_auth(await get_current_user(request))
    require_role(user, ["admin", "finance_team"])
    
    # Update invoice status to paid
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
    
    # Get invoice for notification
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    
    # Send notification to admin (optional - can implement later)
    # For now, just return success
    
    return {
        "status": "success",
        "message": "Invoice marked as paid",
        "invoice_id": invoice_id,
        "payment_id": payment_id
    }

@api_router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhook for payment confirmations"""
    try:
        payload = await request.body()
        signature = request.headers.get('X-Razorpay-Signature', '')
        
        # Note: In production, verify webhook signature
        # For now, we'll process the webhook
        
        data = await request.json()
        event = data.get('event')
        
        if event == 'payment_link.paid':
            payment_link = data.get('payload', {}).get('payment_link', {}).get('entity', {})
            payment_link_id = payment_link.get('id')
            
            if payment_link_id:
                # Find invoice with this payment link
                invoice = await db.invoices.find_one(
                    {"payment_link_id": payment_link_id},
                    {"_id": 0}
                )
                
                if invoice:
                    # Mark as paid
                    await db.invoices.update_one(
                        {"invoice_id": invoice["invoice_id"]},
                        {"$set": {
                            "status": "paid",
                            "payment_received_at": datetime.now(timezone.utc).isoformat(),
                            "webhook_data": data
                        }}
                    )
                    
                    logger.info(f"Invoice {invoice['invoice_id']} marked as paid via webhook")
        
        return {"status": "processed"}
        
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request):
    user = require_auth(await get_current_user(request))
    
    total_customers = await db.customers.count_documents({})
    total_subscriptions = await db.subscriptions.count_documents({"status": "active"})
    
    subscriptions = await db.subscriptions.find({"status": "active"}, {"_id": 0}).to_list(1000)
    total_mrr = sum(sub["mrr"] for sub in subscriptions)
    
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    total_revenue = sum(inv["amount"] for inv in invoices if inv["status"] == "paid")
    pending_revenue = sum(inv["amount"] for inv in invoices if inv["status"] == "pending")
    
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
    total_expenses = sum(exp["amount"] for exp in expenses)
    
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
        created_at = invoice["created_at"]
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        month_key = created_at.strftime("%Y-%m")
        revenue_by_month[month_key] = revenue_by_month.get(month_key, 0) + invoice["amount"]
    
    chart_data = [{"month": k, "revenue": v} for k, v in sorted(revenue_by_month.items())]
    
    return chart_data

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