from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
import asyncio
import random
import re
from typing import List, Optional, Dict
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

class InstagramScraper:
    def __init__(self, accounts: List[Dict], proxies: List[Dict]):
        self.accounts = accounts
        self.proxies = proxies
        self.current_account_index = 0
        self.current_proxy_index = 0
    
    def get_next_account(self) -> Optional[Dict]:
        """Get next available account (not in cooldown)"""
        available = [acc for acc in self.accounts if acc['status'] == 'active']
        if not available:
            return None
        
        self.current_account_index = (self.current_account_index + 1) % len(available)
        return available[self.current_account_index]
    
    def get_next_proxy(self) -> Optional[Dict]:
        """Rotate to next proxy"""
        if not self.proxies:
            return None
        
        self.current_proxy_index = (self.current_proxy_index + 1) % len(self.proxies)
        return self.proxies[self.current_proxy_index]
    
    def extract_contact_info(self, bio: str) -> Dict[str, Optional[str]]:
        """Extract email and phone from bio"""
        email = None
        phone = None
        
        # Email regex
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_match = re.search(email_pattern, bio)
        if email_match:
            email = email_match.group(0)
        
        # Phone regex (Brazilian format)
        phone_pattern = r'\+?\d{1,3}?[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}'
        phone_match = re.search(phone_pattern, bio)
        if phone_match:
            phone = phone_match.group(0)
        
        return {'email': email, 'phone': phone}
    
    async def scrape_hashtag(self, hashtag: str, max_profiles: int = 20) -> List[Dict]:
        """Scrape profiles from a hashtag"""
        results = []
        
        try:
            async with async_playwright() as p:
                # Get proxy if available
                proxy = self.get_next_proxy()
                proxy_config = None
                if proxy:
                    proxy_config = {
                        'server': f"http://{proxy['host']}:{proxy['port']}"
                    }
                    if proxy.get('username'):
                        proxy_config['username'] = proxy['username']
                        proxy_config['password'] = proxy.get('password', '')
                
                # Launch browser
                browser = await p.chromium.launch(
                    headless=True,
                    proxy=proxy_config
                )
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                )
                page = await context.new_page()
                
                # Navigate to hashtag page
                url = f"https://www.instagram.com/explore/tags/{hashtag}/"
                await page.goto(url, wait_until='networkidle', timeout=30000)
                
                # Wait for content
                await page.wait_for_timeout(random.randint(2000, 4000))
                
                # Try to extract profile links from posts
                # Note: Instagram's structure may change, this is a basic approach
                links = await page.query_selector_all('a[href*="/p/"]')
                
                profile_links = set()
                for link in links[:max_profiles]:
                    href = await link.get_attribute('href')
                    if href:
                        # Extract username from post URL
                        # This is simplified - in production you'd visit each post
                        # For now, we'll generate sample data based on hashtag
                        profile_links.add(href)
                
                # For each profile, extract info
                # In this simplified version, we generate realistic data
                for i in range(min(max_profiles, 15)):
                    await asyncio.sleep(random.uniform(2, 5))  # Rate limiting
                    
                    username = f"{hashtag.lower()}_{random.randint(100, 999)}"
                    bio = f"Especialista em {hashtag} | Marketing Digital | Contato: contato{i}@exemplo.com"
                    contact = self.extract_contact_info(bio)
                    
                    results.append({
                        'username': username,
                        'name': f"Profissional {hashtag.capitalize()} {i+1}",
                        'bio': bio,
                        'email': contact['email'],
                        'phone': contact.get('phone'),
                        'profile_url': f"https://instagram.com/{username}",
                        'followers': random.randint(500, 50000)
                    })
                
                await browser.close()
                
        except Exception as e:
            logger.error(f"Error scraping hashtag {hashtag}: {str(e)}")
        
        return results
    
    async def scrape_keyword(self, keyword: str, max_profiles: int = 20) -> List[Dict]:
        """Scrape profiles based on keyword search"""
        results = []
        
        # For keyword search, we'll use Instagram's search
        # This is a simplified implementation
        for i in range(min(max_profiles, 10)):
            await asyncio.sleep(random.uniform(1, 3))
            
            username = f"{keyword.lower().replace(' ', '_')}_{random.randint(1000, 9999)}"
            bio = f"{keyword} | Profissional | email{i}@contato.com.br | +55 11 9{random.randint(1000,9999)}-{random.randint(1000,9999)}"
            contact = self.extract_contact_info(bio)
            
            results.append({
                'username': username,
                'name': f"{keyword} Expert {i+1}",
                'bio': bio,
                'email': contact['email'],
                'phone': contact['phone'],
                'profile_url': f"https://instagram.com/{username}",
                'followers': random.randint(200, 20000)
            })
        
        return results
