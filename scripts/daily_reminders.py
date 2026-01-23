#!/usr/bin/env python3
"""
Daily Reminders Cron Job
Run this script daily to check for overdue invoices and trigger automated actions

Setup:
1. Make executable: chmod +x /app/scripts/daily_reminders.py
2. Add to crontab: 0 9 * * * /usr/bin/python3 /app/scripts/daily_reminders.py
   (This runs daily at 9 AM)
"""

import sys
import os
import requests
from datetime import datetime

# Add backend directory to path
sys.path.insert(0, '/app/backend')

# Configuration - use external URL for API calls
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fintrack-693.preview.emergentagent.com')
API_URL = f"{BACKEND_URL}/api"

# Admin credentials (should be stored securely in production)
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@test.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Test123!')

def log(message):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")

def login():
    """Authenticate and get session cookie"""
    try:
        session = requests.Session()
        response = session.post(
            f"{API_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        response.raise_for_status()
        data = response.json()
        # Return the session with cookies set
        return session, data.get('session_token')
    except Exception as e:
        log(f"Login failed: {e}")
        return None, None

def check_reminders(session):
    """Check for pending invoices and get recommended actions"""
    try:
        response = session.get(f"{API_URL}/reminders/check-pending-invoices")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        log(f"Failed to check reminders: {e}")
        return None

def process_actions(actions, session):
    """Process recommended actions"""
    for action in actions:
        customer_id = action['customer_id']
        recommended = action['recommended_action']
        
        log(f"Customer: {action['customer_name']} - {recommended}")
        
        if recommended == 'shutdown_account':
            log(f"  → Would shutdown account for {customer_id}")
            # Uncomment to enable:
            # session.post(
            #     f"{API_URL}/customers/{customer_id}/shutdown-account",
            #     params={"reason": action['reason']}
            # )
            
        elif recommended == 'suspend_account':
            log(f"  → Would suspend account for {customer_id}")
            # Uncomment to enable:
            # session.post(
            #     f"{API_URL}/customers/{customer_id}/suspend-account",
            #     params={"reason": action['reason']}
            # )
            
        elif recommended in ['send_reminder', 'send_final_reminder', 'send_low_balance_alert']:
            log(f"  → Would send email: {recommended}")
            # Uncomment to enable:
            # session.post(
            #     f"{API_URL}/receivables/send-payment-email",
            #     params={"invoice_id": action['invoice_id']}
            # )

def main():
    log("Starting daily reminders check...")
    
    # Login
    session, token = login()
    if not session or not token:
        log("ERROR: Authentication failed. Exiting.")
        sys.exit(1)
    
    log(f"Authentication successful (token: {token[:20]}...)")
    
    # Check reminders
    result = check_reminders(session)
    if result is None:
        log("ERROR: Failed to fetch reminders")
        sys.exit(1)
    
    total = result.get('total_overdue', 0)
    actions = result.get('actions_needed', [])
    
    log(f"Found {total} overdue invoices")
    log(f"Actions needed: {len(actions)}")
    
    if actions:
        process_actions(actions, session)
    else:
        log("No actions needed today")
    
    log("Daily reminders check complete")

if __name__ == '__main__':
    main()
