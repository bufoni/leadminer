#!/usr/bin/env python3
"""
LeadMiner Backend API Testing Suite
Comprehensive testing for all endpoints
"""

import asyncio
import httpx
import json
import time
from datetime import datetime
from typing import Optional, Dict, Any

# Base URL from environment
BASE_URL = "https://teste-check.preview.emergentagent.com/api"

class LeadMinerTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.client = None
        self.auth_token = None
        self.test_user_id = None
        self.results = {}
        self.user_email = f"test_validation_{int(time.time())}@test.com"
        self.user_password = "Test123!"
        
    async def setup(self):
        """Setup HTTP client"""
        self.client = httpx.AsyncClient(timeout=60.0)
        
    async def cleanup(self):
        """Cleanup HTTP client"""
        if self.client:
            await self.client.aclose()
            
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"    Details: {details}")
        self.results[test_name] = {"success": success, "details": details}
        
    async def test_auth_register(self) -> bool:
        """Test user registration"""
        try:
            payload = {
                "email": self.user_email,
                "password": self.user_password,
                "name": "Test Validation User"
            }
            
            response = await self.client.post(f"{self.base_url}/auth/register", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.auth_token = data["token"]
                    self.test_user_id = data["user"]["id"]
                    self.log_result("Auth - User Registration", True, f"User created with ID: {self.test_user_id}")
                    return True
                else:
                    self.log_result("Auth - User Registration", False, "Missing token or user in response")
                    return False
            else:
                self.log_result("Auth - User Registration", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Auth - User Registration", False, f"Exception: {str(e)}")
            return False
    
    async def test_auth_login(self) -> bool:
        """Test user login"""
        try:
            payload = {
                "email": self.user_email,
                "password": self.user_password
            }
            
            response = await self.client.post(f"{self.base_url}/auth/login", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    # Update token (should be the same, but good practice)
                    self.auth_token = data["token"]
                    self.log_result("Auth - User Login", True, "Login successful")
                    return True
                else:
                    self.log_result("Auth - User Login", False, "Missing token or user in response")
                    return False
            else:
                self.log_result("Auth - User Login", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Auth - User Login", False, f"Exception: {str(e)}")
            return False
    
    async def test_auth_me(self) -> bool:
        """Test get current user"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "email" in data and data["email"] == self.user_email:
                    self.log_result("Auth - Get Current User", True, f"User data retrieved for {data['email']}")
                    return True
                else:
                    self.log_result("Auth - Get Current User", False, "Incorrect user data returned")
                    return False
            else:
                self.log_result("Auth - Get Current User", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Auth - Get Current User", False, f"Exception: {str(e)}")
            return False
    
    async def test_dashboard_stats(self) -> bool:
        """Test dashboard statistics"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/dashboard/stats", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["total_leads", "leads_used", "leads_limit", "total_searches", "plan"]
                if all(field in data for field in required_fields):
                    self.log_result("Dashboard - Get Stats", True, f"Stats: {data['total_leads']} leads, {data['plan']} plan")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_result("Dashboard - Get Stats", False, f"Missing fields: {missing}")
                    return False
            else:
                self.log_result("Dashboard - Get Stats", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Dashboard - Get Stats", False, f"Exception: {str(e)}")
            return False
    
    async def test_create_search(self) -> Optional[str]:
        """Test creating a new search"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            payload = {
                "keywords": ["marketing digital", "empreendedorismo"],
                "hashtags": ["marketing", "negocios"],
                "location": "Brazil",
                "max_leads": 5
            }
            
            response = await self.client.post(f"{self.base_url}/searches", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "status" in data:
                    search_id = data["id"]
                    self.log_result("Search - Create Search", True, f"Search created with ID: {search_id}")
                    return search_id
                else:
                    self.log_result("Search - Create Search", False, "Missing id or status in response")
                    return None
            else:
                self.log_result("Search - Create Search", False, f"Status: {response.status_code}, Body: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Search - Create Search", False, f"Exception: {str(e)}")
            return None
    
    async def test_get_searches(self) -> bool:
        """Test getting user searches"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/searches", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Search - Get Searches", True, f"Retrieved {len(data)} searches")
                    return True
                else:
                    self.log_result("Search - Get Searches", False, "Response is not a list")
                    return False
            else:
                self.log_result("Search - Get Searches", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Search - Get Searches", False, f"Exception: {str(e)}")
            return False
    
    async def test_get_specific_search(self, search_id: str) -> bool:
        """Test getting a specific search"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/searches/{search_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["id"] == search_id:
                    self.log_result("Search - Get Specific Search", True, f"Retrieved search {search_id}")
                    return True
                else:
                    self.log_result("Search - Get Specific Search", False, "Search ID mismatch")
                    return False
            else:
                self.log_result("Search - Get Specific Search", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Search - Get Specific Search", False, f"Exception: {str(e)}")
            return False
    
    async def test_get_leads(self) -> Optional[str]:
        """Test getting leads"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/leads", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Leads - Get Leads", True, f"Retrieved {len(data)} leads")
                    # Return first lead ID if available
                    if data and "id" in data[0]:
                        return data[0]["id"]
                    return "no_leads"
                else:
                    self.log_result("Leads - Get Leads", False, "Response is not a list")
                    return None
            else:
                self.log_result("Leads - Get Leads", False, f"Status: {response.status_code}, Body: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Leads - Get Leads", False, f"Exception: {str(e)}")
            return None
    
    async def test_update_lead(self, lead_id: str) -> bool:
        """Test updating a lead"""
        try:
            if lead_id == "no_leads":
                self.log_result("Leads - Update Lead", True, "Skipped - no leads available")
                return True
                
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            payload = {
                "status": "contacted",
                "qualification": "quente",
                "notes": "Test update from automated testing"
            }
            
            response = await self.client.patch(f"{self.base_url}/leads/{lead_id}", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["status"] == "contacted":
                    self.log_result("Leads - Update Lead", True, f"Lead {lead_id} updated successfully")
                    return True
                else:
                    self.log_result("Leads - Update Lead", False, "Update not reflected in response")
                    return False
            else:
                self.log_result("Leads - Update Lead", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Leads - Update Lead", False, f"Exception: {str(e)}")
            return False
    
    async def test_export_leads_csv(self) -> bool:
        """Test exporting leads to CSV"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/leads/export/csv", headers=headers)
            
            if response.status_code == 200:
                content_type = response.headers.get("content-type", "")
                if "text/csv" in content_type or "application/octet-stream" in content_type:
                    self.log_result("Leads - Export CSV", True, "CSV file exported successfully")
                    return True
                else:
                    self.log_result("Leads - Export CSV", False, f"Unexpected content type: {content_type}")
                    return False
            else:
                self.log_result("Leads - Export CSV", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Leads - Export CSV", False, f"Exception: {str(e)}")
            return False
    
    async def test_scraping_accounts_crud(self) -> bool:
        """Test scraping accounts CRUD operations"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Test CREATE
            payload = {
                "username": f"test_account_{int(time.time())}",
                "password": "test_password"
            }
            
            response = await self.client.post(f"{self.base_url}/scraping-accounts", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                account_id = data.get("id")
                
                # Test READ
                response = await self.client.get(f"{self.base_url}/scraping-accounts", headers=headers)
                if response.status_code == 200:
                    accounts = response.json()
                    
                    # Test DELETE
                    response = await self.client.delete(f"{self.base_url}/scraping-accounts/{account_id}", headers=headers)
                    if response.status_code == 200:
                        self.log_result("Scraping Accounts CRUD", True, "Create/Read/Delete operations successful")
                        return True
                    else:
                        self.log_result("Scraping Accounts CRUD", False, f"Delete failed: {response.status_code}")
                        return False
                else:
                    self.log_result("Scraping Accounts CRUD", False, f"Read failed: {response.status_code}")
                    return False
            else:
                self.log_result("Scraping Accounts CRUD", False, f"Create failed: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Scraping Accounts CRUD", False, f"Exception: {str(e)}")
            return False
    
    async def test_proxies_crud(self) -> bool:
        """Test proxies CRUD operations"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Test CREATE
            payload = {
                "host": "192.168.1.100",
                "port": 8080,
                "username": "test_proxy",
                "password": "test_proxy_pass"
            }
            
            response = await self.client.post(f"{self.base_url}/proxies", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                proxy_id = data.get("id")
                
                # Test READ
                response = await self.client.get(f"{self.base_url}/proxies", headers=headers)
                if response.status_code == 200:
                    proxies = response.json()
                    
                    # Test DELETE
                    response = await self.client.delete(f"{self.base_url}/proxies/{proxy_id}", headers=headers)
                    if response.status_code == 200:
                        self.log_result("Proxies CRUD", True, "Create/Read/Delete operations successful")
                        return True
                    else:
                        self.log_result("Proxies CRUD", False, f"Delete failed: {response.status_code}")
                        return False
                else:
                    self.log_result("Proxies CRUD", False, f"Read failed: {response.status_code}")
                    return False
            else:
                self.log_result("Proxies CRUD", False, f"Create failed: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Proxies CRUD", False, f"Exception: {str(e)}")
            return False
    
    async def test_get_plans(self) -> bool:
        """Test getting available plans"""
        try:
            response = await self.client.get(f"{self.base_url}/plans")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "trial" in data:
                    self.log_result("Plans - Get Plans", True, f"Retrieved {len(data)} plans")
                    return True
                else:
                    self.log_result("Plans - Get Plans", False, "Invalid plans structure")
                    return False
            else:
                self.log_result("Plans - Get Plans", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Plans - Get Plans", False, f"Exception: {str(e)}")
            return False
    
    async def test_payment_checkout(self) -> bool:
        """Test creating Stripe checkout session"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Test with starter plan
            response = await self.client.post(f"{self.base_url}/payments/checkout?plan=starter", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "session_id" in data and "url" in data:
                    session_id = data["session_id"]
                    self.log_result("Payment - Create Checkout", True, f"Checkout session created: {session_id}")
                    return True
                else:
                    self.log_result("Payment - Create Checkout", False, f"Missing session_id or url. Got: {list(data.keys())}")
                    return False
            else:
                self.log_result("Payment - Create Checkout", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Payment - Create Checkout", False, f"Exception: {str(e)}")
            return False

    async def test_get_notifications(self) -> Optional[str]:
        """Test getting user notifications"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/notifications", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["notifications", "total", "unread_count"]
                if all(field in data for field in required_fields):
                    notifications = data["notifications"]
                    total = data["total"]
                    unread_count = data["unread_count"]
                    self.log_result("Notifications - Get Notifications", True, 
                                  f"Retrieved {total} notifications ({unread_count} unread)")
                    
                    # Return first notification ID if available
                    if notifications and len(notifications) > 0 and "id" in notifications[0]:
                        return notifications[0]["id"]
                    return "no_notifications"
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_result("Notifications - Get Notifications", False, f"Missing fields: {missing}")
                    return None
            else:
                self.log_result("Notifications - Get Notifications", False, 
                              f"Status: {response.status_code}, Body: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Notifications - Get Notifications", False, f"Exception: {str(e)}")
            return None

    async def test_mark_notification_read(self, notification_id: str) -> bool:
        """Test marking a notification as read"""
        try:
            if notification_id == "no_notifications":
                self.log_result("Notifications - Mark Notification Read", True, "Skipped - no notifications available")
                return True
                
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.patch(f"{self.base_url}/notifications/{notification_id}/read", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") is True:
                    self.log_result("Notifications - Mark Notification Read", True, 
                                  f"Notification {notification_id} marked as read")
                    return True
                else:
                    self.log_result("Notifications - Mark Notification Read", False, 
                                  "Success field not true in response")
                    return False
            else:
                self.log_result("Notifications - Mark Notification Read", False, 
                              f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Notifications - Mark Notification Read", False, f"Exception: {str(e)}")
            return False

    async def test_mark_all_notifications_read(self) -> bool:
        """Test marking all notifications as read"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.patch(f"{self.base_url}/notifications/read-all", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") is True:
                    self.log_result("Notifications - Mark All Read", True, "All notifications marked as read")
                    return True
                else:
                    self.log_result("Notifications - Mark All Read", False, 
                                  "Success field not true in response")
                    return False
            else:
                self.log_result("Notifications - Mark All Read", False, 
                              f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Notifications - Mark All Read", False, f"Exception: {str(e)}")
            return False

    async def wait_for_search_completion(self, search_id: str, max_wait: int = 30) -> bool:
        """Wait for search to complete (for testing purposes)"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            for _ in range(max_wait):
                response = await self.client.get(f"{self.base_url}/searches/{search_id}", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status")
                    if status in ["finished", "failed"]:
                        return status == "finished"
                
                await asyncio.sleep(1)
            
            return False
        except:
            return False

    async def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚀 Starting LeadMiner Backend API Tests")
        print(f"📡 Base URL: {self.base_url}")
        print(f"👤 Test User: {self.user_email}")
        print("=" * 60)
        
        await self.setup()
        
        try:
            # High Priority Tests
            print("\n🔒 AUTHENTICATION TESTS")
            await self.test_auth_register()
            await self.test_auth_login()
            await self.test_auth_me()
            
            print("\n📊 DASHBOARD TESTS")
            await self.test_dashboard_stats()
            
            print("\n🔍 SEARCH TESTS")
            search_id = await self.test_create_search()
            await self.test_get_searches()
            if search_id:
                await self.test_get_specific_search(search_id)
            
            print("\n📋 LEADS TESTS")
            # Wait a bit for search to process
            if search_id:
                print("⏳ Waiting for search to complete...")
                completed = await self.wait_for_search_completion(search_id, 15)
                if completed:
                    print("✅ Search completed, testing leads...")
                else:
                    print("⚠️  Search still processing, testing with existing leads...")
            
            lead_id = await self.test_get_leads()
            if lead_id:
                await self.test_update_lead(lead_id)
            await self.test_export_leads_csv()
            
            print("\n🛠️  ADMIN TESTS (Medium Priority)")
            await self.test_scraping_accounts_crud()
            await self.test_proxies_crud()
            
            print("\n💰 PLANS & PAYMENT TESTS")
            await self.test_get_plans()
            await self.test_payment_checkout()
            
            print("\n🔔 NOTIFICATION TESTS")
            notification_id = await self.test_get_notifications()
            if notification_id:
                await self.test_mark_notification_read(notification_id)
            await self.test_mark_all_notifications_read()
            
            # Summary
            print("\n" + "=" * 60)
            print("📋 TEST SUMMARY")
            print("=" * 60)
            
            passed = sum(1 for r in self.results.values() if r["success"])
            total = len(self.results)
            
            for test_name, result in self.results.items():
                status = "✅ PASS" if result["success"] else "❌ FAIL"
                print(f"{status}: {test_name}")
                if not result["success"] and result["details"]:
                    print(f"    Error: {result['details']}")
            
            print(f"\n📊 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
            
            if passed == total:
                print("🎉 All tests passed! Backend is working correctly.")
            else:
                failed = total - passed
                print(f"⚠️  {failed} test(s) failed. Please check the details above.")
            
        finally:
            await self.cleanup()

async def main():
    """Main test runner"""
    tester = LeadMinerTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())