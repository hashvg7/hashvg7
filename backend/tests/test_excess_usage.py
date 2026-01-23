"""
Backend API Tests for Finance Panel - Excess Usage Feature
Tests the excess-usage endpoint and related functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "Test123!"
TEST_CUSTOMER_ID = "cust_7dac594a9f3c"


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
    
    def test_auth_me_with_token(self):
        """Test /auth/me endpoint with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["session_token"]
        
        # Test auth/me
        response = requests.get(f"{BASE_URL}/api/auth/me", 
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
    
    def test_auth_me_without_token(self):
        """Test /auth/me endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


class TestExcessUsageEndpoint:
    """Tests for /api/usage-logs/excess-usage endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_excess_usage_returns_data(self):
        """Test excess-usage endpoint returns data for Jan 2026"""
        response = requests.get(
            f"{BASE_URL}/api/usage-logs/excess-usage?year=2026&month=1",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "year" in data
        assert "month" in data
        assert "total_customers_exceeding" in data
        assert "customers" in data
        assert data["year"] == 2026
        assert data["month"] == 1
    
    def test_excess_usage_contains_test_customer(self):
        """Test that test customer with excess usage is returned"""
        response = requests.get(
            f"{BASE_URL}/api/usage-logs/excess-usage?year=2026&month=1",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have at least 1 customer exceeding limits
        assert data["total_customers_exceeding"] >= 1
        
        # Find test customer
        test_customer = None
        for customer in data["customers"]:
            if customer["customer_id"] == TEST_CUSTOMER_ID:
                test_customer = customer
                break
        
        assert test_customer is not None, f"Test customer {TEST_CUSTOMER_ID} not found"
        assert test_customer["customer_name"] == "Test Excess Corp"
        assert test_customer["email"] == "excess@test.com"
        assert len(test_customer["exceeded_services"]) >= 1
    
    def test_excess_usage_service_details(self):
        """Test that exceeded services have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/usage-logs/excess-usage?year=2026&month=1",
            headers=self.headers
        )
        data = response.json()
        
        for customer in data["customers"]:
            for service in customer["exceeded_services"]:
                assert "service" in service
                assert "usage" in service
                assert "expected_limit" in service
                assert "excess" in service
                assert "excess_percentage" in service
                # Verify excess calculation
                assert service["excess"] == service["usage"] - service["expected_limit"]
    
    def test_excess_usage_empty_month(self):
        """Test excess-usage for month with no data"""
        response = requests.get(
            f"{BASE_URL}/api/usage-logs/excess-usage?year=2020&month=1",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_customers_exceeding"] == 0
        assert data["customers"] == []
    
    def test_excess_usage_requires_auth(self):
        """Test that excess-usage requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/usage-logs/excess-usage?year=2026&month=1"
        )
        assert response.status_code == 401


class TestPendingInvoicesEndpoint:
    """Tests for /api/reminders/check-pending-invoices endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_check_pending_invoices_returns_data(self):
        """Test check-pending-invoices endpoint returns proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/reminders/check-pending-invoices",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_overdue" in data
        assert "actions_needed" in data
        assert "checked_at" in data
        assert isinstance(data["total_overdue"], int)
        assert isinstance(data["actions_needed"], list)
    
    def test_check_pending_invoices_requires_auth(self):
        """Test that check-pending-invoices requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/reminders/check-pending-invoices"
        )
        assert response.status_code == 401


class TestCustomersEndpoint:
    """Tests for /api/customers endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_customers(self):
        """Test getting list of customers"""
        response = requests.get(
            f"{BASE_URL}/api/customers",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify test customer exists
        customer_ids = [c["customer_id"] for c in data]
        assert TEST_CUSTOMER_ID in customer_ids


class TestUsageLogsEndpoint:
    """Tests for /api/usage-logs endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = login_response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_usage_logs_for_customer(self):
        """Test getting usage logs for specific customer"""
        response = requests.get(
            f"{BASE_URL}/api/usage-logs/{TEST_CUSTOMER_ID}?year=2026&month=1",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should have usage logs for test customer
        if len(data) > 0:
            for log in data:
                assert log["customer_id"] == TEST_CUSTOMER_ID
                assert "service" in log
                assert "count" in log


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
