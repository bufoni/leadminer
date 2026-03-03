#!/usr/bin/env python3
"""
Check if notification was generated after search completion
"""

import asyncio
import httpx

BASE_URL = "https://teste-check.preview.emergentagent.com/api"

async def check_notifications():
    """Check for notifications for test_notif@test.com"""
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
            
            # Get notifications
            headers = {"Authorization": f"Bearer {auth_token}"}
            response = await client.get(f"{BASE_URL}/notifications", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                notifications = data["notifications"]
                total = data["total"]
                unread_count = data["unread_count"]
                
                print(f"✅ Notifications check: {total} notifications ({unread_count} unread)")
                
                if notifications:
                    for i, notif in enumerate(notifications):
                        print(f"📋 Notification {i+1}:")
                        print(f"    Type: {notif.get('type', 'unknown')}")
                        print(f"    Title: {notif.get('title', 'No title')}")
                        print(f"    Message: {notif.get('message', 'No message')}")
                        print(f"    Read: {notif.get('read', 'unknown')}")
                        print(f"    Created: {notif.get('created_at', 'unknown')}")
                        print("")
                        
                    # Test marking first notification as read
                    if len(notifications) > 0:
                        notif_id = notifications[0]["id"]
                        response = await client.patch(f"{BASE_URL}/notifications/{notif_id}/read", headers=headers)
                        
                        if response.status_code == 200:
                            print(f"✅ Successfully marked notification {notif_id} as read")
                        else:
                            print(f"❌ Failed to mark notification as read: {response.status_code}")
                else:
                    print("ℹ️  No notifications found")
            else:
                print(f"❌ Failed to get notifications: {response.status_code}")
        else:
            print(f"❌ Failed to login: {response.status_code}")
            
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(check_notifications())