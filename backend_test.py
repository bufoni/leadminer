#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, List

class LeadMinerAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.token = None
        self.user_id = None
        self.test_user_email = f"test_user_{datetime.now().strftime('%H%M%S')}@test.com"
        self.test_user_password = "TestPass123!"
        self.test_user_name = "Test User"
        
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.created_search_id = None
        self.created_lead_id = None
        self.created_account_id = None
        self.created_proxy_id = None

    def log_test_result(self, test_name: str, success: bool, details: str = "", response_data: Dict = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        result = {
            "test_name": test_name,
            "status": status,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")

    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, 
                    expected_status: int = 200, require_auth: bool = False) -> tuple:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if require_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}
            
            return success, response_data
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e), "exception_type": type(e).__name__}

    def test_auth_register(self):
        """Test user registration"""
        success, response = self.make_request(
            'POST', 
            'auth/register',
            data={
                "email": self.test_user_email,
                "password": self.test_user_password,
                "name": self.test_user_name
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            self.log_test_result("Auth - User Registration", True, f"User ID: {self.user_id}")
        else:
            self.log_test_result("Auth - User Registration", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_auth_login(self):
        """Test user login"""
        success, response = self.make_request(
            'POST',
            'auth/login', 
            data={
                "email": self.test_user_email,
                "password": self.test_user_password
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.log_test_result("Auth - User Login", True, "Login successful")
        else:
            self.log_test_result("Auth - User Login", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_auth_me(self):
        """Test get current user"""
        success, response = self.make_request('GET', 'auth/me', require_auth=True)
        
        if success and response.get('email') == self.test_user_email:
            self.log_test_result("Auth - Get Current User", True, 
                               f"User: {response.get('name')} ({response.get('email')})")
        else:
            self.log_test_result("Auth - Get Current User", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.make_request('GET', 'dashboard/stats', require_auth=True)
        
        expected_keys = ['total_leads', 'leads_used', 'leads_limit', 'total_searches', 'plan']
        if success and all(key in response for key in expected_keys):
            self.log_test_result("Dashboard - Get Stats", True, 
                               f"Plan: {response.get('plan')}, Leads: {response.get('leads_used')}/{response.get('leads_limit')}")
        else:
            self.log_test_result("Dashboard - Get Stats", False, 
                               f"Missing keys or failed: {response}", response)

    def test_create_search(self):
        """Test creating a new search"""
        success, response = self.make_request(
            'POST',
            'searches',
            data={
                "keywords": ["marketing", "digital"],
                "hashtags": ["marketing", "business"],
                "location": "São Paulo, Brasil"
            },
            expected_status=200,
            require_auth=True
        )
        
        if success and 'id' in response:
            self.created_search_id = response['id']
            self.log_test_result("Search - Create Search", True, 
                               f"Search ID: {self.created_search_id}")
        else:
            self.log_test_result("Search - Create Search", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_get_searches(self):
        """Test getting user searches"""
        success, response = self.make_request('GET', 'searches', require_auth=True)
        
        if success and isinstance(response, list):
            self.log_test_result("Search - Get Searches", True, f"Found {len(response)} searches")
        else:
            self.log_test_result("Search - Get Searches", False, 
                               f"Failed: {response.get('detail', 'Expected list')}", response)

    def test_get_search_by_id(self):
        """Test getting specific search"""
        if not self.created_search_id:
            self.log_test_result("Search - Get Search by ID", False, "No search ID available")
            return
        
        success, response = self.make_request(
            'GET', 
            f'searches/{self.created_search_id}',
            require_auth=True
        )
        
        if success and response.get('id') == self.created_search_id:
            self.log_test_result("Search - Get Search by ID", True, 
                               f"Status: {response.get('status')}, Progress: {response.get('progress', 0)}%")
        else:
            self.log_test_result("Search - Get Search by ID", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_get_leads(self):
        """Test getting leads"""
        success, response = self.make_request('GET', 'leads', require_auth=True)
        
        if success and isinstance(response, list):
            if len(response) > 0:
                self.created_lead_id = response[0]['id']
            self.log_test_result("Leads - Get Leads", True, f"Found {len(response)} leads")
        else:
            self.log_test_result("Leads - Get Leads", False, 
                               f"Failed: {response.get('detail', 'Expected list')}", response)

    def test_update_lead(self):
        """Test updating lead status"""
        if not self.created_lead_id:
            self.log_test_result("Leads - Update Lead", False, "No lead ID available")
            return
        
        success, response = self.make_request(
            'PATCH',
            f'leads/{self.created_lead_id}',
            data={"status": "contacted"},
            require_auth=True
        )
        
        if success and response.get('status') == 'contacted':
            self.log_test_result("Leads - Update Lead", True, "Lead status updated to 'contacted'")
        else:
            self.log_test_result("Leads - Update Lead", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_export_leads_csv(self):
        """Test CSV export"""
        try:
            url = f"{self.base_url}/api/leads/export/csv"
            headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}
            
            response = requests.get(url, headers=headers, timeout=10)
            success = response.status_code == 200 and 'text/csv' in response.headers.get('content-type', '')
            
            if success:
                self.log_test_result("Leads - Export CSV", True, "CSV export successful")
            else:
                self.log_test_result("Leads - Export CSV", False, 
                                   f"Status: {response.status_code}, Content-Type: {response.headers.get('content-type')}")
        except Exception as e:
            self.log_test_result("Leads - Export CSV", False, f"Exception: {str(e)}")

    def test_create_scraping_account(self):
        """Test creating scraping account"""
        success, response = self.make_request(
            'POST',
            'scraping-accounts',
            data={
                "username": "test_instagram_account",
                "password": "test_password_123"
            },
            require_auth=True
        )
        
        if success and 'id' in response:
            self.created_account_id = response['id']
            self.log_test_result("Scraping - Create Account", True, 
                               f"Account ID: {self.created_account_id}")
        else:
            self.log_test_result("Scraping - Create Account", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_get_scraping_accounts(self):
        """Test getting scraping accounts"""
        success, response = self.make_request('GET', 'scraping-accounts', require_auth=True)
        
        if success and isinstance(response, list):
            self.log_test_result("Scraping - Get Accounts", True, f"Found {len(response)} accounts")
        else:
            self.log_test_result("Scraping - Get Accounts", False, 
                               f"Failed: {response.get('detail', 'Expected list')}", response)

    def test_delete_scraping_account(self):
        """Test deleting scraping account"""
        if not self.created_account_id:
            self.log_test_result("Scraping - Delete Account", False, "No account ID available")
            return
        
        success, response = self.make_request(
            'DELETE',
            f'scraping-accounts/{self.created_account_id}',
            expected_status=200,
            require_auth=True
        )
        
        if success:
            self.log_test_result("Scraping - Delete Account", True, "Account deleted successfully")
        else:
            self.log_test_result("Scraping - Delete Account", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_create_proxy(self):
        """Test creating proxy"""
        success, response = self.make_request(
            'POST',
            'proxies',
            data={
                "host": "127.0.0.1",
                "port": 8080,
                "username": "test_user",
                "password": "test_pass"
            },
            require_auth=True
        )
        
        if success and 'id' in response:
            self.created_proxy_id = response['id']
            self.log_test_result("Proxy - Create Proxy", True, 
                               f"Proxy ID: {self.created_proxy_id}")
        else:
            self.log_test_result("Proxy - Create Proxy", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_get_proxies(self):
        """Test getting proxies"""
        success, response = self.make_request('GET', 'proxies', require_auth=True)
        
        if success and isinstance(response, list):
            self.log_test_result("Proxy - Get Proxies", True, f"Found {len(response)} proxies")
        else:
            self.log_test_result("Proxy - Get Proxies", False, 
                               f"Failed: {response.get('detail', 'Expected list')}", response)

    def test_delete_proxy(self):
        """Test deleting proxy"""
        if not self.created_proxy_id:
            self.log_test_result("Proxy - Delete Proxy", False, "No proxy ID available")
            return
        
        success, response = self.make_request(
            'DELETE',
            f'proxies/{self.created_proxy_id}',
            expected_status=200,
            require_auth=True
        )
        
        if success:
            self.log_test_result("Proxy - Delete Proxy", True, "Proxy deleted successfully")
        else:
            self.log_test_result("Proxy - Delete Proxy", False, 
                               f"Failed: {response.get('detail', 'Unknown error')}", response)

    def test_get_plans(self):
        """Test getting available plans"""
        success, response = self.make_request('GET', 'plans')
        
        expected_plans = ['trial', 'starter', 'pro', 'business']
        if success and isinstance(response, dict) and all(plan in response for plan in expected_plans):
            self.log_test_result("Plans - Get Plans", True, f"Found {len(response)} plans")
        else:
            self.log_test_result("Plans - Get Plans", False, 
                               f"Failed: {response.get('detail', 'Missing expected plans')}", response)

    def test_stripe_checkout(self):
        """Test Stripe checkout creation"""
        success, response = self.make_request(
            'POST',
            'payments/checkout?plan=starter',
            require_auth=True
        )
        
        # Stripe checkout should return session data
        if success and ('url' in response or 'session_id' in response):
            self.log_test_result("Payment - Create Checkout", True, "Checkout session created")
        else:
            # This might fail due to Stripe test keys, log as warning
            self.log_test_result("Payment - Create Checkout", False, 
                               f"Expected but might fail with test keys: {response.get('detail', 'Unknown error')}")

    def run_all_tests(self):
        """Run comprehensive API test suite"""
        print(f"\n🚀 Starting LeadMiner API Test Suite")
        print(f"📍 Testing against: {self.base_url}")
        print(f"👤 Test user: {self.test_user_email}")
        print("=" * 60)
        
        # Authentication tests
        self.test_auth_register()
        self.test_auth_login() 
        self.test_auth_me()
        
        # Dashboard tests
        self.test_dashboard_stats()
        
        # Search tests
        self.test_create_search()
        import time
        time.sleep(2)  # Wait for search processing
        self.test_get_searches()
        self.test_get_search_by_id()
        
        # Lead tests - wait a bit more for leads to be generated
        time.sleep(3)
        self.test_get_leads()
        self.test_update_lead()
        self.test_export_leads_csv()
        
        # Configuration tests
        self.test_create_scraping_account()
        self.test_get_scraping_accounts()
        self.test_delete_scraping_account()
        
        self.test_create_proxy()
        self.test_get_proxies()
        self.test_delete_proxy()
        
        # Plan and payment tests
        self.test_get_plans()
        self.test_stripe_checkout()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary:")
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {self.tests_run - self.tests_passed}/{self.tests_run}")
        print(f"📈 Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        # Print failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"   • {test['test_name']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        # Use environment variable or default
        base_url = "https://lead-scraper-8.preview.emergentagent.com"
    
    tester = LeadMinerAPITester(base_url)
    success = tester.run_all_tests()
    
    # Save results to JSON for analysis
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'base_url': base_url,
            'summary': {
                'tests_run': tester.tests_run,
                'tests_passed': tester.tests_passed,
                'success_rate': tester.tests_passed / tester.tests_run * 100 if tester.tests_run > 0 else 0
            },
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())