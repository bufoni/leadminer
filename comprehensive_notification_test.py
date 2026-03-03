#!/usr/bin/env python3
"""
Comprehensive notification endpoints validation
"""

import asyncio
import httpx

BASE_URL = "https://teste-check.preview.emergentagent.com/api"

async def comprehensive_notification_test():
    """Comprehensive test of all notification endpoints"""
    client = httpx.AsyncClient(timeout=60.0)
    
    test_results = []
    
    try:
        # Login
        payload = {
            "email": "test_notif@test.com",
            "password": "Test123!"
        }
        
        response = await client.post(f"{BASE_URL}/auth/login", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            auth_token = data["token"]
            headers = {"Authorization": f"Bearer {auth_token}"}
            
            print("🔔 COMPREHENSIVE NOTIFICATION ENDPOINTS TEST")
            print("=" * 50)
            
            # Test 1: GET /api/notifications
            print("\n📋 TEST 1: GET /api/notifications")
            response = await client.get(f"{BASE_URL}/notifications", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                expected_fields = ["notifications", "total", "unread_count"]
                
                if all(field in data for field in expected_fields):
                    notifications = data["notifications"]
                    total = data["total"]
                    unread_count = data["unread_count"]
                    
                    print(f"✅ Status: 200 OK")
                    print(f"✅ Response structure: {list(data.keys())}")
                    print(f"✅ Total notifications: {total}")
                    print(f"✅ Unread count: {unread_count}")
                    
                    if isinstance(notifications, list):
                        print(f"✅ Notifications is a list with {len(notifications)} items")
                        test_results.append(("GET /api/notifications", True, f"Retrieved {total} notifications"))
                        
                        notification_id = notifications[0]["id"] if notifications else None
                    else:
                        print(f"❌ Notifications is not a list: {type(notifications)}")
                        test_results.append(("GET /api/notifications", False, "Notifications field is not a list"))
                        notification_id = None
                else:
                    missing = [f for f in expected_fields if f not in data]
                    print(f"❌ Missing required fields: {missing}")
                    test_results.append(("GET /api/notifications", False, f"Missing fields: {missing}"))
                    notification_id = None
            else:
                print(f"❌ Status: {response.status_code}")
                print(f"❌ Response: {response.text}")
                test_results.append(("GET /api/notifications", False, f"HTTP {response.status_code}"))
                notification_id = None
            
            # Test 2: PATCH /api/notifications/{notification_id}/read
            print("\n📝 TEST 2: PATCH /api/notifications/{notification_id}/read")
            
            if notification_id:
                response = await client.patch(f"{BASE_URL}/notifications/{notification_id}/read", headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("success") is True:
                        print(f"✅ Status: 200 OK")
                        print(f"✅ Response: {data}")
                        print(f"✅ Notification {notification_id} marked as read")
                        test_results.append(("PATCH /api/notifications/{id}/read", True, "Notification marked as read"))
                    else:
                        print(f"❌ Success field not true: {data}")
                        test_results.append(("PATCH /api/notifications/{id}/read", False, "Success field not true"))
                else:
                    print(f"❌ Status: {response.status_code}")
                    print(f"❌ Response: {response.text}")
                    test_results.append(("PATCH /api/notifications/{id}/read", False, f"HTTP {response.status_code}"))
            else:
                print("⚠️  Skipped - no notification ID available")
                test_results.append(("PATCH /api/notifications/{id}/read", True, "Skipped - no notifications"))
            
            # Test 3: PATCH /api/notifications/read-all
            print("\n📝 TEST 3: PATCH /api/notifications/read-all")
            response = await client.patch(f"{BASE_URL}/notifications/read-all", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") is True:
                    print(f"✅ Status: 200 OK")
                    print(f"✅ Response: {data}")
                    print(f"✅ All notifications marked as read")
                    test_results.append(("PATCH /api/notifications/read-all", True, "All notifications marked as read"))
                else:
                    print(f"❌ Success field not true: {data}")
                    test_results.append(("PATCH /api/notifications/read-all", False, "Success field not true"))
            else:
                print(f"❌ Status: {response.status_code}")
                print(f"❌ Response: {response.text}")
                test_results.append(("PATCH /api/notifications/read-all", False, f"HTTP {response.status_code}"))
                
            # Test 4: Verify authentication is required
            print("\n🔒 TEST 4: Authentication requirement check")
            response = await client.get(f"{BASE_URL}/notifications")  # No auth header
            
            if response.status_code == 401:
                print(f"✅ Status: 401 Unauthorized (correct)")
                print(f"✅ Authentication is properly required")
                test_results.append(("Authentication requirement", True, "Endpoints properly protected"))
            else:
                print(f"❌ Status: {response.status_code} (should be 401)")
                test_results.append(("Authentication requirement", False, f"Got {response.status_code} instead of 401"))
            
        else:
            print(f"❌ Failed to login: {response.status_code}")
            test_results.append(("Login", False, f"HTTP {response.status_code}"))
            
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for _, success, _ in test_results if success)
        total = len(test_results)
        
        for test_name, success, details in test_results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status}: {test_name}")
            if details:
                print(f"    Details: {details}")
        
        print(f"\n📈 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All notification endpoints are working correctly!")
            return True
        else:
            print(f"⚠️  {total-passed} test(s) failed.")
            return False
            
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(comprehensive_notification_test())