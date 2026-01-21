#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class FinancePanelAPITester:
    def __init__(self, base_url="https://bizfinpanel.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_resources = {
            'customers': [],
            'subscriptions': [],
            'invoices': [],
            'expenses': [],
            'rate_tiers': []
        }

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED {details}")
        else:
            self.failed_tests.append(f"{test_name}: {details}")
            print(f"❌ {test_name}: FAILED {details}")

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make API request with authentication"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(datetime.now().timestamp())
        test_data = {
            "email": f"test.user.{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}",
            "role": "admin"
        }

        success, response = self.make_request("POST", "auth/register", test_data, 200)
        if success and "user_id" in response:
            self.log_result("User Registration", True, f"User ID: {response['user_id']}")
            return test_data
        else:
            self.log_result("User Registration", False, f"Response: {response}")
            return None

    def test_user_login(self, user_data: Dict):
        """Test user login"""
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }

        success, response = self.make_request("POST", "auth/login", login_data, 200)
        if success and "session_token" in response and "user" in response:
            self.session_token = response["session_token"]
            self.user_data = response["user"]
            self.log_result("User Login", True, f"Session token obtained")
            return True
        else:
            self.log_result("User Login", False, f"Response: {response}")
            return False

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        success, response = self.make_request("GET", "auth/me", None, 200)
        if success and "user_id" in response:
            self.log_result("Auth Me", True, f"User: {response.get('name', 'Unknown')}")
            return True
        else:
            self.log_result("Auth Me", False, f"Response: {response}")
            return False

    def test_create_customer(self):
        """Test customer creation"""
        timestamp = int(datetime.now().timestamp())
        customer_data = {
            "name": f"Test Customer {timestamp}",
            "email": f"customer.{timestamp}@example.com",
            "phone": "+1234567890",
            "company": f"Test Company {timestamp}",
            "permissions": {
                "view_invoices": True,
                "view_reports": True,
                "make_payments": True,
                "view_subscriptions": True,
                "view_dashboard": True,
                "view_analytics": False
            }
        }

        success, response = self.make_request("POST", "customers", customer_data, 200)
        if success and "customer_id" in response:
            self.created_resources['customers'].append(response["customer_id"])
            self.log_result("Create Customer", True, f"Customer ID: {response['customer_id']}")
            return response["customer_id"]
        else:
            self.log_result("Create Customer", False, f"Response: {response}")
            return None

    def test_get_customers(self):
        """Test get customers"""
        success, response = self.make_request("GET", "customers", None, 200)
        if success and isinstance(response, list):
            self.log_result("Get Customers", True, f"Found {len(response)} customers")
            return True
        else:
            self.log_result("Get Customers", False, f"Response: {response}")
            return False

    def test_create_subscription(self, customer_id: str):
        """Test subscription creation"""
        subscription_data = {
            "customer_id": customer_id,
            "plan_name": "Premium Plan",
            "mrr": 999.99,
            "status": "active"
        }

        success, response = self.make_request("POST", "subscriptions", subscription_data, 200)
        if success and "subscription_id" in response:
            self.created_resources['subscriptions'].append(response["subscription_id"])
            self.log_result("Create Subscription", True, f"Subscription ID: {response['subscription_id']}")
            return response["subscription_id"]
        else:
            self.log_result("Create Subscription", False, f"Response: {response}")
            return None

    def test_get_subscriptions(self):
        """Test get subscriptions"""
        success, response = self.make_request("GET", "subscriptions", None, 200)
        if success and isinstance(response, list):
            self.log_result("Get Subscriptions", True, f"Found {len(response)} subscriptions")
            return True
        else:
            self.log_result("Get Subscriptions", False, f"Response: {response}")
            return False

    def test_create_invoice(self, customer_id: str):
        """Test invoice creation"""
        due_date = (datetime.now() + timedelta(days=30)).isoformat()
        invoice_data = {
            "customer_id": customer_id,
            "amount": 1500.00,
            "status": "pending",
            "items": [
                {"description": "Service Fee", "amount": 1000.00},
                {"description": "Setup Fee", "amount": 500.00}
            ],
            "due_date": due_date
        }

        success, response = self.make_request("POST", "invoices", invoice_data, 200)
        if success and "invoice_id" in response:
            self.created_resources['invoices'].append(response["invoice_id"])
            self.log_result("Create Invoice", True, f"Invoice ID: {response['invoice_id']}")
            return response["invoice_id"]
        else:
            self.log_result("Create Invoice", False, f"Response: {response}")
            return None

    def test_get_invoices(self):
        """Test get invoices"""
        success, response = self.make_request("GET", "invoices", None, 200)
        if success and isinstance(response, list):
            self.log_result("Get Invoices", True, f"Found {len(response)} invoices")
            return True
        else:
            self.log_result("Get Invoices", False, f"Response: {response}")
            return False

    def test_create_expense(self):
        """Test expense creation"""
        expense_data = {
            "category": "Marketing",
            "amount": 750.00,
            "description": "Digital advertising campaign",
            "date": datetime.now().isoformat()
        }

        success, response = self.make_request("POST", "expenses", expense_data, 200)
        if success and "expense_id" in response:
            self.created_resources['expenses'].append(response["expense_id"])
            self.log_result("Create Expense", True, f"Expense ID: {response['expense_id']}")
            return response["expense_id"]
        else:
            self.log_result("Create Expense", False, f"Response: {response}")
            return None

    def test_get_expenses(self):
        """Test get expenses"""
        success, response = self.make_request("GET", "expenses", None, 200)
        if success and isinstance(response, list):
            self.log_result("Get Expenses", True, f"Found {len(response)} expenses")
            return True
        else:
            self.log_result("Get Expenses", False, f"Response: {response}")
            return False

    def test_create_rate_tier(self):
        """Test rate tier creation"""
        rate_tier_data = {
            "service_type": "Orders",
            "tier_name": "Tier 1",
            "range_min": 0,
            "range_max": 1000,
            "rate": 50.00
        }

        success, response = self.make_request("POST", "rate-tiers", rate_tier_data, 200)
        if success and "tier_id" in response:
            self.created_resources['rate_tiers'].append(response["tier_id"])
            self.log_result("Create Rate Tier", True, f"Tier ID: {response['tier_id']}")
            return response["tier_id"]
        else:
            self.log_result("Create Rate Tier", False, f"Response: {response}")
            return None

    def test_get_rate_tiers(self):
        """Test get rate tiers"""
        success, response = self.make_request("GET", "rate-tiers", None, 200)
        if success and isinstance(response, list):
            self.log_result("Get Rate Tiers", True, f"Found {len(response)} rate tiers")
            return True
        else:
            self.log_result("Get Rate Tiers", False, f"Response: {response}")
            return False

    def test_analytics_overview(self):
        """Test analytics overview"""
        success, response = self.make_request("GET", "analytics/overview", None, 200)
        if success and "total_customers" in response:
            self.log_result("Analytics Overview", True, f"Total customers: {response.get('total_customers', 0)}")
            return True
        else:
            self.log_result("Analytics Overview", False, f"Response: {response}")
            return False

    def test_analytics_revenue_chart(self):
        """Test revenue chart analytics"""
        success, response = self.make_request("GET", "analytics/revenue-chart", None, 200)
        if success and isinstance(response, list):
            self.log_result("Revenue Chart Analytics", True, f"Chart data points: {len(response)}")
            return True
        else:
            self.log_result("Revenue Chart Analytics", False, f"Response: {response}")
            return False

    def test_logout(self):
        """Test logout"""
        success, response = self.make_request("POST", "auth/logout", None, 200)
        if success:
            self.log_result("Logout", True, "Successfully logged out")
            return True
        else:
            self.log_result("Logout", False, f"Response: {response}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Finance Panel API Tests")
        print("=" * 50)

        # Test authentication flow
        user_data = self.test_user_registration()
        if not user_data:
            print("❌ Cannot proceed without user registration")
            return False

        if not self.test_user_login(user_data):
            print("❌ Cannot proceed without login")
            return False

        if not self.test_auth_me():
            print("❌ Auth verification failed")
            return False

        # Test customer management
        customer_id = self.test_create_customer()
        self.test_get_customers()

        # Test subscription management (requires customer)
        if customer_id:
            self.test_create_subscription(customer_id)
        self.test_get_subscriptions()

        # Test invoice management (requires customer)
        if customer_id:
            self.test_create_invoice(customer_id)
        self.test_get_invoices()

        # Test expense management
        self.test_create_expense()
        self.test_get_expenses()

        # Test rate tier management
        self.test_create_rate_tier()
        self.test_get_rate_tiers()

        # Test analytics
        self.test_analytics_overview()
        self.test_analytics_revenue_chart()

        # Test logout
        self.test_logout()

        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary:")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {len(self.failed_tests)}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")

        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"   - {failure}")

        return len(self.failed_tests) == 0

def main():
    tester = FinancePanelAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())