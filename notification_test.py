#!/usr/bin/env python3
"""
LeadMiner Notification Endpoints Test
Tests specific notification endpoints for the user test_notif@test.com
"""

import asyncio
import httpx
import json
import time
from datetime import datetime
from typing import Optional, Dict, Any

# Base URL from environment
BASE_URL = "https://teste-check.preview.emergentagent.com/api"

class NotificationTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.client = None
        self.auth_token = None
        self.test_user_id = None
        self.results = {}
        self.user_email = "test_notif@test.com"
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
        
    async def register_user(self) -> bool:
        """Register test user if not exists"""
        try:
            payload = {
                "email": self.user_email,
                "password": self.user_password,
                "name": "Test Notification User"
            }
            
            response = await self.client.post(f"{self.base_url}/auth/register", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.auth_token = data["token"]
                    self.test_user_id = data["user"]["id"]
                    self.log_result("Setup - User Registration", True, f"User created with ID: {self.test_user_id}")
                    return True
                else:
                    self.log_result("Setup - User Registration", False, "Missing token or user in response")
                    return False
            elif response.status_code == 400 and "already registered" in response.text:
                # User already exists, try to login
                self.log_result("Setup - User Registration", True, "User already exists, will login")
                return True
            else:
                self.log_result("Setup - User Registration", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Setup - User Registration", False, f"Exception: {str(e)}")
            return False
    
    async def login_user(self) -> bool:
        """Login with test user credentials"""
        try:
            payload = {
                "email": self.user_email,
                "password": self.user_password
            }
            
            response = await self.client.post(f"{self.base_url}/auth/login", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.auth_token = data["token"]
                    self.test_user_id = data["user"]["id"]
                    self.log_result("Setup - User Login", True, "Login successful")
                    return True
                else:
                    self.log_result("Setup - User Login", False, "Missing token or user in response")
                    return False
            else:
                self.log_result("Setup - User Login", False, f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Setup - User Login", False, f"Exception: {str(e)}")
            return False

    async def test_get_notifications(self) -> Optional[str]:
        """Test GET /api/notifications endpoint"""
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
                    self.log_result("GET /api/notifications", True, 
                                  f"Retrieved {total} notifications ({unread_count} unread)")
                    
                    # Print notification details
                    print(f"    📄 Response structure: {list(data.keys())}")
                    if notifications:
                        print(f"    📋 First notification: {notifications[0].get('type', 'unknown')} - {notifications[0].get('title', 'No title')}")
                        return notifications[0].get("id")
                    else:
                        print(f"    ℹ️  No notifications found")
                        return "no_notifications"
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_result("GET /api/notifications", False, f"Missing required fields: {missing}")
                    return None
            else:
                self.log_result("GET /api/notifications", False, 
                              f"Status: {response.status_code}, Body: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("GET /api/notifications", False, f"Exception: {str(e)}")
            return None

    async def test_mark_notification_read(self, notification_id: str) -> bool:
        """Test PATCH /api/notifications/{notification_id}/read endpoint"""
        try:
            if notification_id == "no_notifications":
                self.log_result("PATCH /api/notifications/{id}/read", True, "Skipped - no notifications available")
                return True
                
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.patch(f"{self.base_url}/notifications/{notification_id}/read", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") is True:
                    self.log_result("PATCH /api/notifications/{id}/read", True, 
                                  f"Notification {notification_id} marked as read")
                    return True
                else:
                    self.log_result("PATCH /api/notifications/{id}/read", False, 
                                  f"Success field not true. Response: {data}")
                    return False
            else:
                self.log_result("PATCH /api/notifications/{id}/read", False, 
                              f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("PATCH /api/notifications/{id}/read", False, f"Exception: {str(e)}")
            return False

    async def test_mark_all_notifications_read(self) -> bool:
        """Test PATCH /api/notifications/read-all endpoint"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.patch(f"{self.base_url}/notifications/read-all", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") is True:
                    self.log_result("PATCH /api/notifications/read-all", True, "All notifications marked as read")
                    return True
                else:
                    self.log_result("PATCH /api/notifications/read-all", False, 
                                  f"Success field not true. Response: {data}")
                    return False
            else:
                self.log_result("PATCH /api/notifications/read-all", False, 
                              f"Status: {response.status_code}, Body: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("PATCH /api/notifications/read-all", False, f"Exception: {str(e)}")
            return False

    async def test_create_search_for_notification(self) -> Optional[str]:
        """Create a search to generate notifications when completed"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            payload = {
                "keywords": ["empreendedorismo", "marketing"],
                "hashtags": ["negocios", "startup"],
                "location": "Brazil",
                "max_leads": 3
            }
            
            response = await self.client.post(f"{self.base_url}/searches", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "status" in data:
                    search_id = data["id"]
                    self.log_result("Create Search for Notification", True, 
                                  f"Search created with ID: {search_id}. This should generate a notification when complete.")
                    return search_id
                else:
                    self.log_result("Create Search for Notification", False, "Missing id or status in response")
                    return None
            else:
                self.log_result("Create Search for Notification", False, 
                              f"Status: {response.status_code}, Body: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Create Search for Notification", False, f"Exception: {str(e)}")
            return None

    async def wait_for_search_completion(self, search_id: str, max_wait: int = 30) -> bool:
        """Wait for search to complete and potentially generate notification"""
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            print(f"    ⏳ Waiting for search {search_id} to complete...")
            for i in range(max_wait):
                response = await self.client.get(f"{self.base_url}/searches/{search_id}", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status")
                    progress = data.get("progress", 0)
                    
                    if i % 5 == 0:  # Print every 5 seconds
                        print(f"    📊 Search status: {status}, progress: {progress}%")
                    
                    if status in ["finished", "failed"]:
                        print(f"    ✅ Search completed with status: {status}")
                        return status == "finished"
                
                await asyncio.sleep(1)
            
            print(f"    ⚠️  Search did not complete within {max_wait} seconds")
            return False
        except Exception as e:
            print(f"    ❌ Error waiting for search: {str(e)}")
            return False

    async def run_notification_tests(self):
        """Run notification-specific tests"""
        print(f"🔔 Starting LeadMiner Notification Endpoints Test")
        print(f"📡 Base URL: {self.base_url}")
        print(f"👤 Test User: {self.user_email}")
        print("=" * 60)
        
        await self.setup()
        
        try:
            # Setup user
            print("\n🔐 AUTHENTICATION SETUP")
            user_registered = await self.register_user()
            if not user_registered:
                print("❌ Failed to register user, exiting...")
                return
            
            if not self.auth_token:  # Need to login if registration failed due to existing user
                logged_in = await self.login_user()
                if not logged_in:
                    print("❌ Failed to login user, exiting...")
                    return
            
            print(f"✅ Authenticated successfully. User ID: {self.test_user_id}")
            
            # Test notification endpoints
            print("\n🔔 NOTIFICATION ENDPOINTS TESTING")
            
            # Test 1: GET /api/notifications
            notification_id = await self.test_get_notifications()
            
            # Test 2: PATCH /api/notifications/{id}/read (if notifications exist)
            if notification_id:
                await self.test_mark_notification_read(notification_id)
            
            # Test 3: PATCH /api/notifications/read-all
            await self.test_mark_all_notifications_read()
            
            # Additional test: Create search to generate notification
            print("\n🔍 CREATING SEARCH TO TEST NOTIFICATION GENERATION")
            search_id = await self.test_create_search_for_notification()
            
            if search_id:
                # Wait for search completion
                completed = await self.wait_for_search_completion(search_id, 30)
                
                if completed:
                    print("\n🔔 TESTING NOTIFICATIONS AFTER SEARCH COMPLETION")
                    # Check for new notifications after search completion
                    await asyncio.sleep(2)  # Give a moment for notification creation
                    new_notification_id = await self.test_get_notifications()
                    
                    if new_notification_id and new_notification_id != "no_notifications":
                        print("    ✅ New notification found after search completion!")
                        await self.test_mark_notification_read(new_notification_id)
                    else:
                        print("    ℹ️  No new notifications found (this may be expected if notifications already existed)")
                else:
                    print("    ⚠️  Search did not complete, but notification endpoints were still tested")
            
            # Summary
            print("\n" + "=" * 60)
            print("📋 NOTIFICATION TEST SUMMARY")
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
                print("🎉 All notification tests passed! Notification endpoints are working correctly.")
            else:
                failed = total - passed
                print(f"⚠️  {failed} test(s) failed. Please check the details above.")
            
        finally:
            await self.cleanup()

async def main():
    """Main test runner"""
    tester = NotificationTester()
    await tester.run_notification_tests()

if __name__ == "__main__":
    asyncio.run(main())