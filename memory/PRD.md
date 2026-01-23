# Finance Panel - Product Requirements Document

## Original Problem Statement
Build a full-fledged finance panel for business management with multiple login options (customer and admin). Admins must have control over which features are visible to customers.

## User Personas
1. **Admin** - Full access to all features, user management, and system configuration
2. **Finance Team** - Invoice management, receivables, payments, reports
3. **Accountant** - View reports, invoices, expenses
4. **Sales** - Customer management, subscriptions
5. **PM** - Project-related financial data
6. **Customer** - Limited view based on permissions set by admin

## Core Requirements

### Authentication
- [x] JWT-based email/password authentication
- [x] Google OAuth integration via Emergent
- [x] Role-based access control
- [x] First registered user becomes admin

### Core Features
- [x] Dashboard with key metrics
- [x] Customer Management (CRUD, permissions)
- [x] Invoice Management
- [x] Subscription Management
- [x] Expense Tracking
- [x] Rate Management
- [x] Reports & Analytics
- [x] Receivables with Razorpay integration (MOCKED - test keys)

### Advanced Features (from Excel requirements)
- [x] Automated invoice calculation based on usage
- [x] Payment management (partial/full)
- [x] Account automation (shutdown/suspend)
- [x] ROI calculation by product
- [x] Excess Usage Tracking - NEW (Jan 2026)
- [x] Daily reminders cron job - FIXED (Jan 2026)

## Technology Stack
- **Frontend:** React, React Router, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI, Pydantic, MongoDB (via pymongo)
- **Auth:** JWT, Google OAuth
- **Integrations:** 
  - Razorpay (MOCKED - test keys)
  - AWS SES (MOCKED - stub response)

## Current Architecture
```
/app/
├── backend/
│   ├── server.py           # Main FastAPI app (1100+ lines - needs refactoring)
│   ├── invoice_calculator.py
│   └── tests/
│       └── test_excess_usage.py
├── frontend/
│   └── src/
│       ├── pages/          # All feature pages
│       └── components/     # Sidebar, UI components
└── scripts/
    └── daily_reminders.py  # Cron job script
```

## What's Been Implemented

### January 2026 Session
- Fixed critical `server.py` routing issue (routes after `app.include_router`)
- Implemented Excess Usage Tracking feature:
  - Backend endpoint: `/api/usage-logs/excess-usage`
  - Frontend: "Customers Exceeding Usage Limits" section on Usage Tracking page
- Fixed daily reminders cron job authentication
- Created backend tests (13 tests, 100% pass rate)
- Removed visible "Made with Emergent" branding (platform scripts remain for functionality)

## Prioritized Backlog

### P0 - Critical
- None currently

### P1 - High Priority
- [ ] Create frontend UI for customer rate card management
- [ ] Connect Account Shutdown API to frontend
- [ ] End-to-end test Razorpay integration with live keys

### P2 - Medium Priority
- [ ] Refactor `server.py` into modular routers
- [ ] Full integration of Usage API on frontend
- [ ] AWS SES integration with real credentials

### P3 - Future
- [ ] Mobile responsive improvements
- [ ] Export reports to PDF/Excel
- [ ] Email notification templates

## Test Credentials
- **Admin:** admin@test.com / Test123!
- **Test Customer:** cust_7dac594a9f3c (Test Excess Corp)

## Known Integrations Status
| Integration | Status | Notes |
|------------|--------|-------|
| Razorpay | MOCKED | Using test keys, needs live credentials |
| AWS SES | MOCKED | Returns stub response, needs credentials |
| Google OAuth | Working | Via Emergent auth |
