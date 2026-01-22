# Finance Panel - Complete Feature Guide

## Overview
The Finance Panel now includes comprehensive invoice management, usage tracking, automated payment reminders, account management, and ROI analytics based on your Excel specifications.

---

## 1. Usage Tracking & Invoice Calculation

### Usage Logging
**Endpoint:** `POST /api/usage-logs`

Track customer usage for variable services:
```json
{
  "customer_id": "cust_xxx",
  "service": "orders",
  "count": 1500,
  "year": 2025,
  "month": 1
}
```

**Variable Services Available:**
- `orders` - Orders processed
- `users` - Active users
- `warehouse` - Warehouse usage
- `darkstore` - Darkstore usage
- `store` - Store usage
- `seller_panel` - Seller panel access
- `fba` - FBA transactions
- `sku` - SKU management
- `reco` - Reconciliation
- `dispute_mgmt` - Dispute management
- `listings` - Product listings
- `client_portal` - Client portal access

**Fixed Services:**
- `uat_server` - UAT Server (monthly fee)
- `platform_fees` - Platform Fees (monthly fee)
- `dedicated_support` - Dedicated Support (monthly fee)

### Automatic Invoice Generation
**Endpoint:** `POST /api/invoices/generate-monthly?customer_id=xxx&year=2025&month=1`

Automatically calculates invoice based on:
1. Customer's rate card (price per service)
2. Usage data for the month
3. Fixed monthly fees
4. Tax calculation (18% GST)
5. ROI breakdown by bundle

**Invoice Structure:**
```json
{
  "invoice_id": "inv_xxx",
  "customer_id": "cust_xxx",
  "amount": 15000,
  "status": "pending",
  "items": [
    {
      "service": "Orders",
      "type": "variable",
      "quantity": 1500,
      "rate": 5.0,
      "amount": 7500
    }
  ],
  "subtotal": 12711.86,
  "tax_amount": 2288.14,
  "roi_breakdown": {...},
  "usage_data": {...}
}
```

---

## 2. Customer Configuration

### Rate Card Setup
When creating/updating a customer, set their pricing:

```json
{
  "name": "Company ABC",
  "email": "billing@company.com",
  "rate_card": {
    "orders": 5.0,
    "users": 100.0,
    "warehouse": 2000.0,
    "platform_fees": 5000.0
  },
  "bundles": ["oms_wms", "reco"],
  "minimum_balance": 10000,
  "account_status": "active"
}
```

### Bundles Available
- `oms` - Order Management System
- `wms` - Warehouse Management System
- `reco` - Reconciliation
- `pf_fees` - Platform Fees
- `seller_panel` - Seller Panel
- `pim` - Product Information Management
- `dm` - Dispute Management
- `oms_wms` - OMS + WMS
- `oms_wms_reco` - OMS + WMS + Reco
- `oms_wms_pf` - OMS + WMS + Platform

---

## 3. Payment Management

### Record Partial/Full Payment
**Endpoint:** `POST /api/invoices/{invoice_id}/record-payment`

```json
{
  "amount": 5000,
  "payment_method": "bank_transfer",
  "payment_reference": "TXN123456",
  "notes": "Partial payment received"
}
```

**Payment Statuses:**
- `pending` - No payment received
- `partially_paid` - Partial payment made
- `paid` - Fully paid

**Features:**
- Multiple partial payments supported
- Payment history tracked
- Auto-status update
- Auto-reactivation on full payment

---

## 4. Account Management

### Suspend Account
**Endpoint:** `POST /api/customers/{customer_id}/suspend-account?reason=Payment overdue`

Temporarily suspends customer access.

### Shutdown Account  
**Endpoint:** `POST /api/customers/{customer_id}/shutdown-account?reason=Non-payment`

Permanently shuts down customer account.
**TODO:** Integrate with your service API to actually disable services.

### Reactivate Account
**Endpoint:** `POST /api/customers/{customer_id}/reactivate-account`

Reactivates suspended/shutdown accounts.

**Account Statuses:**
- `active` - Normal operations
- `suspended` - Temporarily disabled
- `shutdown` - Permanently closed

---

## 5. Automated Reminders

### Check Pending Invoices
**Endpoint:** `GET /api/reminders/check-pending-invoices`

Returns list of actions needed:

```json
{
  "total_overdue": 5,
  "actions_needed": [
    {
      "customer_id": "cust_xxx",
      "invoice_id": "inv_xxx",
      "amount_due": 15000,
      "days_overdue": 20,
      "recommended_action": "suspend_account",
      "reason": "Payment overdue by 20 days"
    }
  ]
}
```

**Automated Actions:**
- **3 days overdue:** Send reminder email
- **7 days overdue:** Send final reminder
- **15 days overdue:** Suspend account
- **30 days overdue:** Shutdown account
- **Below minimum balance:** Send low balance alert

**Implementation:**
Set up a cron job to call this endpoint daily and process actions.

---

## 6. ROI Calculation

### Product-wise ROI
**Endpoint:** `GET /api/analytics/roi-by-product?customer_id=xxx&year=2025&month=1`

Calculate ROI by product/bundle:

```json
{
  "product_roi": {
    "OMS + WMS": {
      "total_revenue": 25000,
      "total_usage": 3500,
      "weighted_roi": 45.5,
      "invoice_count": 3
    },
    "Reconciliation": {
      "total_revenue": 8000,
      "total_usage": 1200,
      "weighted_roi": 15.2,
      "invoice_count": 3
    }
  }
}
```

**ROI Weights (from Excel):**
- OMS: 50
- WMS: 50
- Reco: 38
- Platform Fees: 40
- Seller Panel: 50
- PIM: 10
- Dispute Management: 39
- OMS+WMS: 50
- OMS+WMS+Reco: 50
- OMS+WMS+Platform: 20000 (base fee)

---

## 7. Integration Points

### Placeholder Integrations

**1. Usage Data Collection**
```python
# TODO: Integrate with your service APIs
# File: /app/backend/invoice_calculator.py
# Method: get_usage_data()

# Example: Call your API to fetch actual usage
usage_response = requests.get(
    f"https://your-service-api.com/usage/{customer_id}",
    params={"year": year, "month": month}
)
```

**2. Service Shutdown**
```python
# TODO: Integrate shutdown with your service
# File: /app/backend/server.py
# Endpoint: /customers/{customer_id}/shutdown-account

# Example: Call your service API to disable access
shutdown_response = requests.post(
    f"https://your-service-api.com/accounts/{customer_id}/disable"
)
```

**3. Email Reminders**
Use existing AWS SES integration in `/receivables/send-payment-email` as template.

---

## 8. Testing the Features

### Step 1: Create Customer with Rate Card
```bash
curl -X POST "$API_URL/api/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Company",
    "email": "test@company.com",
    "rate_card": {
      "orders": 5.0,
      "users": 100.0,
      "platform_fees": 5000.0
    },
    "bundles": ["oms", "reco"],
    "minimum_balance": 10000
  }'
```

### Step 2: Log Usage
```bash
curl -X POST "$API_URL/api/usage-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_id": "cust_xxx",
    "service": "orders",
    "count": 1500,
    "year": 2025,
    "month": 1
  }'
```

### Step 3: Generate Invoice
```bash
curl -X POST "$API_URL/api/invoices/generate-monthly?customer_id=cust_xxx&year=2025&month=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4: Record Payment
```bash
curl -X POST "$API_URL/api/invoices/inv_xxx/record-payment" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 5000,
    "payment_method": "bank_transfer",
    "payment_reference": "TXN123"
  }'
```

### Step 5: Check Reminders
```bash
curl -X GET "$API_URL/api/reminders/check-pending-invoices" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 6: View ROI
```bash
curl -X GET "$API_URL/api/analytics/roi-by-product?customer_id=cust_xxx" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 9. Database Collections

### New Collections Created:
1. **usage_logs** - Stores usage data per service per customer
2. **invoices** - Enhanced with payment history, ROI, and usage data

### Enhanced Collections:
1. **customers** - Added rate_card, bundles, minimum_balance, account_status

---

## 10. Next Steps

### Required Actions:
1. **Add Razorpay Keys** to `/app/backend/.env`
2. **Add AWS SES Keys** for email reminders
3. **Integrate Usage API** - Connect to your service to fetch actual usage
4. **Integrate Shutdown API** - Connect to your service to disable accounts
5. **Setup Cron Job** - Schedule `/api/reminders/check-pending-invoices` daily
6. **Create Frontend UI** - Build pages for usage tracking, invoice management, and ROI analytics

### Optional Enhancements:
1. **Automated Email Reminders** - Send emails when action recommendations are generated
2. **Payment Gateway** - Direct integration with Razorpay for customer payments
3. **Usage Dashboard** - Real-time usage tracking dashboard
4. **Forecasting** - Predict next month's invoice based on usage trends
5. **Multi-currency Support** - Support for different currencies

---

## Support

For questions or issues, refer to:
- API Documentation: `/docs` (FastAPI automatic docs)
- Integration Playbooks: Check `/app/backend/` for Razorpay and AWS SES setup
- Testing Guide: This document, Section 8

---

**Last Updated:** January 2025
