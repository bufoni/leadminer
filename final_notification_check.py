#!/usr/bin/env python3
"""
Check search status and manually create notification for testing
"""

import asyncio
import httpx

BASE_URL = "https://teste-check.preview.emergentagent.com/api"
SEARCH_ID = "17dfc287-f6d6-4a7a-80e0-cc8907d52648"

async def check_search_and_notifications():
    """Check search status and test notification manually"""
    client = httpx.AsyncClient(timeout=60.0)
    
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
            user_id = data["user"]["id"]
            headers = {"Authorization": f"Bearer {auth_token}"}
            
            # Check search status
            response = await client.get(f"{BASE_URL}/searches/{SEARCH_ID}", headers=headers)
            
            if response.status_code == 200:
                search_data = response.json()
                status = search_data.get("status")
                progress = search_data.get("progress", 0)
                leads_found = search_data.get("leads_found", 0)
                
                print(f"🔍 Search {SEARCH_ID}:")
                print(f"    Status: {status}")
                print(f"    Progress: {progress}%")
                print(f"    Leads found: {leads_found}")
                print("")
                
                if status == "finished":
                    print("✅ Search completed! This should have generated a notification.")
                elif status == "running":
                    print("⏳ Search still running...")
                elif status == "failed":
                    print("❌ Search failed")
                
                # Check notifications again
                response = await client.get(f"{BASE_URL}/notifications", headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    notifications = data["notifications"]
                    total = data["total"]
                    unread_count = data["unread_count"]
                    
                    print(f"\n🔔 Current notifications: {total} notifications ({unread_count} unread)")
                    
                    if notifications:
                        for i, notif in enumerate(notifications):
                            print(f"📋 Notification {i+1}:")
                            print(f"    Type: {notif.get('type', 'unknown')}")
                            print(f"    Title: {notif.get('title', 'No title')}")
                            print(f"    Message: {notif.get('message', 'No message')}")
                            print(f"    Read: {notif.get('read', 'unknown')}")
                            
                            # Test marking as read
                            notif_id = notif["id"]
                            read_response = await client.patch(f"{BASE_URL}/notifications/{notif_id}/read", headers=headers)
                            
                            if read_response.status_code == 200:
                                print(f"    ✅ Marked as read successfully")
                            else:
                                print(f"    ❌ Failed to mark as read: {read_response.status_code}")
                            print("")
                    else:
                        print("ℹ️  No notifications found yet")
                        
                    # Test mark all as read
                    read_all_response = await client.patch(f"{BASE_URL}/notifications/read-all", headers=headers)
                    
                    if read_all_response.status_code == 200:
                        data = read_all_response.json()
                        if data.get("success"):
                            print("✅ Mark all notifications as read: SUCCESS")
                        else:
                            print(f"❌ Mark all as read failed: {data}")
                    else:
                        print(f"❌ Mark all as read endpoint failed: {read_all_response.status_code}")
                        
                else:
                    print(f"❌ Failed to get notifications: {response.status_code}")
            else:
                print(f"❌ Failed to get search: {response.status_code}")
                
        else:
            print(f"❌ Failed to login: {response.status_code}")
            
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(check_search_and_notifications())