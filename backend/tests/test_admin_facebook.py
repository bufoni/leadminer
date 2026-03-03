"""
Backend API Tests for LeadMiner - Admin Dashboard & Facebook Auth
Tests admin endpoints (stats, users, searches) and Facebook authentication flow
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@leadminer.com"
ADMIN_PASSWORD = "Admin123!"

class TestSetup:
    """Setup and health check tests"""
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/plans")
        assert response.status_code == 200
        print(f"✅ API health check passed - /api/plans returned {response.status_code}")
        data = response.json()
        assert "trial" in data
        assert "starter" in data
        print(f"✅ Plans data structure validated")


class TestAdminAuth:
    """Admin authentication tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 401:
            # Admin user may not exist, try to register first
            print("⚠️ Admin user not found, creating admin user...")
            reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "name": "Admin User"
            })
            if reg_response.status_code == 200 or reg_response.status_code == 201:
                print(f"✅ Admin user created")
                return reg_response.json().get("token")
            else:
                pytest.skip(f"Failed to create admin user: {reg_response.status_code}")
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✅ Admin login successful - user role: {data['user'].get('role')}")
        return data["token"]
    
    def test_admin_login(self, admin_token):
        """Test admin can login"""
        assert admin_token is not None
        print(f"✅ Admin authentication working")


class TestAdminEndpoints:
    """Admin dashboard endpoint tests"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 401:
            # Try to register admin first
            reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "name": "Admin User"
            })
            if reg_response.status_code in [200, 201]:
                token = reg_response.json().get("token")
                return {"Authorization": f"Bearer {token}"}
            pytest.skip("Admin user not available")
        
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_admin_stats_endpoint(self, admin_headers):
        """Test /api/admin/stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
        
        assert response.status_code == 200, f"Admin stats failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_users" in data
        assert "total_leads" in data
        assert "total_searches" in data
        assert "active_accounts" in data
        assert "active_proxies" in data
        assert "leads_today" in data
        assert "searches_today" in data
        
        print(f"✅ Admin stats endpoint working:")
        print(f"   - Total users: {data['total_users']}")
        print(f"   - Total leads: {data['total_leads']}")
        print(f"   - Total searches: {data['total_searches']}")
        print(f"   - Active accounts: {data['active_accounts']}")
        print(f"   - Active proxies: {data['active_proxies']}")
    
    def test_admin_users_endpoint(self, admin_headers):
        """Test /api/admin/users endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        
        assert response.status_code == 200, f"Admin users failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Expected list of users"
        print(f"✅ Admin users endpoint working - {len(data)} users found")
        
        # Check user structure if there are users
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "password" not in user  # Password should not be exposed
            print(f"   - First user: {user.get('email')} ({user.get('role')})")
    
    def test_admin_recent_searches_endpoint(self, admin_headers):
        """Test /api/admin/recent-searches endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/recent-searches", headers=admin_headers)
        
        assert response.status_code == 200, f"Admin recent searches failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Expected list of searches"
        print(f"✅ Admin recent searches endpoint working - {len(data)} searches found")
        
        # Check search structure if there are searches
        if len(data) > 0:
            search = data[0]
            assert "id" in search
            assert "user_id" in search
            assert "status" in search
            print(f"   - First search status: {search.get('status')}, leads found: {search.get('leads_found', 0)}")
    
    def test_admin_endpoints_require_admin_role(self):
        """Test that admin endpoints are protected for non-admin users"""
        # Create a regular user
        test_email = "TEST_regular_user@test.com"
        test_password = "TestPass123!"
        
        # Try to register as regular user
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "name": "Regular User"
        })
        
        if reg_response.status_code == 400:
            # User already exists, try login
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email,
                "password": test_password
            })
            if login_response.status_code != 200:
                pytest.skip("Could not authenticate as regular user")
            token = login_response.json().get("token")
        elif reg_response.status_code in [200, 201]:
            token = reg_response.json().get("token")
        else:
            pytest.skip("Could not create regular user")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access admin stats - should fail for non-admin
        stats_response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        
        # Should be 403 Forbidden
        assert stats_response.status_code == 403, f"Expected 403 for non-admin, got {stats_response.status_code}"
        print(f"✅ Admin endpoints properly protected - non-admin got 403")


class TestFacebookAuth:
    """Facebook authentication endpoint tests"""
    
    def test_facebook_session_endpoint_exists(self):
        """Test /api/auth/facebook/session endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/auth/facebook/session", json={
            "redirect_url": "https://example.com/callback"
        })
        
        # Expected: 503 if Facebook App ID not configured, or 200 if configured
        if response.status_code == 503:
            data = response.json()
            assert "detail" in data
            assert "Facebook" in data["detail"] or "not configured" in data["detail"].lower()
            print(f"✅ Facebook session endpoint exists but returns 503 (expected - no FACEBOOK_APP_ID configured)")
            print(f"   - Message: {data['detail']}")
        elif response.status_code == 200:
            data = response.json()
            assert "auth_url" in data
            print(f"✅ Facebook session endpoint working - auth_url returned")
        else:
            # Any other status code is a failure
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")
    
    def test_facebook_callback_endpoint_exists(self):
        """Test /api/auth/facebook/callback endpoint exists"""
        # This will fail without proper code/state, but should return 400 not 404
        response = requests.post(f"{BASE_URL}/api/auth/facebook/callback", json={
            "code": "fake_code",
            "state": "fake_state"
        })
        
        # Expected: 400 (bad request due to invalid state) or 503 (not configured)
        assert response.status_code in [400, 503], f"Expected 400 or 503, got {response.status_code}"
        print(f"✅ Facebook callback endpoint exists - returned {response.status_code}")
    
    def test_facebook_session_missing_redirect_url(self):
        """Test /api/auth/facebook/session validation"""
        response = requests.post(f"{BASE_URL}/api/auth/facebook/session", json={})
        
        # Should return 400 for missing redirect_url
        assert response.status_code == 400, f"Expected 400 for missing redirect_url, got {response.status_code}"
        print(f"✅ Facebook session validation working - missing redirect_url returns 400")


class TestGoogleAuth:
    """Google authentication endpoint tests"""
    
    def test_google_session_endpoint_exists(self):
        """Test /api/auth/google/session endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/auth/google/session", json={
            "redirect_url": "https://example.com/callback"
        })
        
        # Should return 200 or 503 (if not available)
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}"
        print(f"✅ Google session endpoint exists - returned {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert "session_id" in data
            assert "auth_url" in data
            print(f"   - Session ID received, auth_url present")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
