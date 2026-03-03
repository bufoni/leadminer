from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from playwright.async_api import async_playwright
import asyncio
import random
import re
import logging
import os
import json
import httpx

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeadMiner Scraper Service", version="1.0.0")

# Session storage path
SESSION_FILE = "/tmp/instagram_session.json"

# ===================== MODELS =====================

class AccountConfig(BaseModel):
    username: str
    password: str
    status: str = "active"

class ProxyConfig(BaseModel):
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    status: str = "active"

class ScrapeRequest(BaseModel):
    keywords: List[str] = []
    hashtags: List[str] = []
    max_profiles: int = 20
    accounts: List[AccountConfig] = []
    proxies: List[ProxyConfig] = []

class LeadResult(BaseModel):
    username: str
    name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    profile_url: str
    followers: Optional[int] = None
    source: str = "hashtag"

class ScrapeResponse(BaseModel):
    success: bool
    leads: List[LeadResult]
    total_found: int
    errors: List[str] = []

# ===================== SCRAPER CLASS =====================

class InstagramScraper:
    def __init__(self, accounts: List[Dict], proxies: List[Dict]):
        self.accounts = accounts
        self.proxies = proxies
        self.current_account_index = 0
        self.current_proxy_index = 0
    
    def get_next_account(self) -> Optional[Dict]:
        """Get next available account (not in cooldown)"""
        available = [acc for acc in self.accounts if acc.get('status') == 'active']
        if not available:
            return None
        
        self.current_account_index = (self.current_account_index + 1) % len(available)
        return available[self.current_account_index]
    
    def get_next_proxy(self) -> Optional[Dict]:
        """Rotate to next proxy"""
        if not self.proxies:
            return None
        
        active_proxies = [p for p in self.proxies if p.get('status') == 'active']
        if not active_proxies:
            return None
        
        self.current_proxy_index = (self.current_proxy_index + 1) % len(active_proxies)
        return active_proxies[self.current_proxy_index]
    
    def extract_contact_info(self, bio: str) -> Dict[str, Optional[str]]:
        """Extract email and phone from bio"""
        email = None
        phone = None
        
        if not bio:
            return {'email': None, 'phone': None}
        
        # Email regex
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_match = re.search(email_pattern, bio)
        if email_match:
            email = email_match.group(0)
        
        # Phone regex (multiple formats including Brazilian)
        phone_patterns = [
            r'\+?\d{1,3}?[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}',  # International
            r'\(\d{2}\)\s*\d{4,5}-?\d{4}',  # Brazilian (XX) XXXXX-XXXX
            r'\d{2}\s*\d{4,5}\s*\d{4}',  # Brazilian without formatting
        ]
        
        for pattern in phone_patterns:
            phone_match = re.search(pattern, bio)
            if phone_match:
                phone = phone_match.group(0)
                break
        
        return {'email': email, 'phone': phone}
    
    async def scrape_profile_via_api(self, username: str) -> Optional[Dict]:
        """Scrape profile using Instagram's web API"""
        try:
            url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'X-IG-App-ID': '936619743392459',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json',
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10.0)
                
                if response.status_code == 200:
                    data = response.json()
                    user_data = data.get('data', {}).get('user', {})
                    
                    if user_data:
                        bio = user_data.get('biography', '')
                        contact = self.extract_contact_info(bio)
                        
                        return {
                            'username': user_data.get('username', username),
                            'name': user_data.get('full_name'),
                            'bio': bio,
                            'email': contact['email'],
                            'phone': contact['phone'],
                            'profile_url': f'https://instagram.com/{username}',
                            'followers': user_data.get('edge_followed_by', {}).get('count'),
                            'source': 'api'
                        }
        except Exception as e:
            logger.debug(f"API scrape failed for {username}: {str(e)}")
        
        return None
    
    async def login_instagram(self, page, account: Dict) -> bool:
        """Login to Instagram with provided account"""
        try:
            await page.goto('https://www.instagram.com/accounts/login/', wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(random.randint(3000, 5000))
            
            # Check if already logged in
            if '/accounts/login' not in page.url:
                return True
            
            # Wait for login form to appear - try multiple selectors
            username_input = None
            for selector in ['input[name="username"]', 'input[aria-label*="username"]', 'input[aria-label*="Phone"]', 'input[type="text"]']:
                try:
                    username_input = await page.wait_for_selector(selector, timeout=5000)
                    if username_input:
                        break
                except:
                    continue
            
            if not username_input:
                logger.error("Could not find username input field")
                return False
            
            # Fill login form
            await username_input.fill(account['username'])
            await page.wait_for_timeout(random.randint(500, 1000))
            
            password_input = None
            for selector in ['input[name="password"]', 'input[aria-label*="Password"]', 'input[type="password"]']:
                try:
                    password_input = await page.wait_for_selector(selector, timeout=5000)
                    if password_input:
                        break
                except:
                    continue
            
            if password_input:
                await password_input.fill(account['password'])
            await page.wait_for_timeout(random.randint(500, 1500))
            
            # Submit - try multiple methods
            submitted = False
            for selector in ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("Entrar")']:
                try:
                    submit_btn = await page.query_selector(selector)
                    if submit_btn:
                        await submit_btn.click()
                        submitted = True
                        break
                except:
                    continue
            
            if not submitted:
                await page.keyboard.press('Enter')
            
            await page.wait_for_timeout(random.randint(5000, 8000))
            
            # Check for success
            if '/accounts/login' not in page.url and 'challenge' not in page.url:
                logger.info(f"Successfully logged in as {account['username']}")
                return True
            
            if 'challenge' in page.url:
                logger.warning(f"Instagram is requesting verification for {account['username']}")
            
            logger.warning(f"Login may have failed for {account['username']}")
            return False
            
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return False
    
    async def scrape_profile(self, page, username: str) -> Optional[Dict]:
        """Scrape a single profile - tries API first, then Playwright"""
        # Try API first (faster and doesn't require login)
        api_result = await self.scrape_profile_via_api(username)
        if api_result:
            return api_result
        
        # Fallback to Playwright
        try:
            await page.goto(f'https://www.instagram.com/{username}/', wait_until='domcontentloaded', timeout=20000)
            await page.wait_for_timeout(random.randint(1500, 3000))
            
            # Check if profile exists
            if 'Page Not Found' in await page.title() or await page.query_selector('text="Sorry, this page'):
                return None
            
            # Extract data
            result = {
                'username': username,
                'name': None,
                'bio': None,
                'email': None,
                'phone': None,
                'profile_url': f'https://instagram.com/{username}',
                'followers': None
            }
            
            # Get name
            name_elem = await page.query_selector('header section span')
            if name_elem:
                result['name'] = await name_elem.inner_text()
            
            # Get bio
            bio_elem = await page.query_selector('header section div > span')
            if bio_elem:
                result['bio'] = await bio_elem.inner_text()
                contact = self.extract_contact_info(result['bio'])
                result['email'] = contact['email']
                result['phone'] = contact['phone']
            
            # Get followers count
            followers_elem = await page.query_selector('a[href*="followers"] span')
            if followers_elem:
                followers_text = await followers_elem.inner_text()
                # Parse followers (handles K, M suffixes)
                followers_text = followers_text.replace(',', '').replace('.', '')
                if 'K' in followers_text or 'k' in followers_text:
                    result['followers'] = int(float(followers_text.replace('K', '').replace('k', '')) * 1000)
                elif 'M' in followers_text or 'm' in followers_text:
                    result['followers'] = int(float(followers_text.replace('M', '').replace('m', '')) * 1000000)
                else:
                    try:
                        result['followers'] = int(followers_text)
                    except:
                        pass
            
            return result
            
        except Exception as e:
            logger.error(f"Error scraping profile {username}: {str(e)}")
            return None
    
    async def scrape_hashtag(self, hashtag: str, max_profiles: int = 20) -> List[Dict]:
        """Scrape profiles from a hashtag"""
        results = []
        errors = []
        
        try:
            async with async_playwright() as p:
                # Launch browser
                browser = await p.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                )
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                )
                page = await context.new_page()
                
                # Login if account available
                account = self.get_next_account()
                logged_in = False
                if account:
                    logged_in = await self.login_instagram(page, account)
                    if not logged_in:
                        logger.warning("Proceeding without login - will try to scrape public profiles")
                
                # Navigate to hashtag page
                hashtag_clean = hashtag.replace('#', '').strip()
                url = f"https://www.instagram.com/explore/tags/{hashtag_clean}/"
                logger.info(f"Navigating to {url}")
                
                await page.goto(url, wait_until='domcontentloaded', timeout=30000)
                await page.wait_for_timeout(random.randint(3000, 5000))
                
                # Check if page requires login
                page_content = await page.content()
                if 'Log in' in page_content and not logged_in:
                    logger.warning("Instagram requires login to view hashtag page")
                    # Try alternative approach - scrape related profiles directly
                    
                # Scroll to load more content
                for _ in range(5):
                    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                    await page.wait_for_timeout(random.randint(2000, 3000))
                
                # Try multiple selectors for post links
                post_links = []
                for selector in ['a[href*="/p/"]', 'article a[href*="/p/"]', 'div[role="presentation"] a']:
                    post_links = await page.query_selector_all(selector)
                    if len(post_links) > 0:
                        break
                
                logger.info(f"Found {len(post_links)} posts for hashtag #{hashtag_clean}")
                
                usernames_found = set()
                
                # Visit posts to get usernames
                for link in post_links[:min(len(post_links), max_profiles * 3)]:
                    if len(usernames_found) >= max_profiles:
                        break
                    
                    try:
                        href = await link.get_attribute('href')
                        if href and '/p/' in href:
                            await page.goto(f'https://www.instagram.com{href}', wait_until='domcontentloaded', timeout=20000)
                            await page.wait_for_timeout(random.randint(2000, 3000))
                            
                            # Try multiple selectors to find username
                            for selector in ['header a[href*="/"]', 'a[role="link"][href*="/"]', 'span a[href*="/"]']:
                                username_elem = await page.query_selector(selector)
                                if username_elem:
                                    username_href = await username_elem.get_attribute('href')
                                    if username_href and '/' in username_href:
                                        username = username_href.strip('/').split('/')[-1]
                                        # Filter out common non-username paths
                                        if username and username not in usernames_found and username not in ['p', 'explore', 'reels', 'stories', 'accounts']:
                                            usernames_found.add(username)
                                            logger.info(f"Found username: {username}")
                                            break
                    except Exception as e:
                        logger.error(f"Error extracting username: {str(e)}")
                
                logger.info(f"Collected {len(usernames_found)} unique usernames")
                
                # Scrape each profile
                for username in usernames_found:
                    if len(results) >= max_profiles:
                        break
                    
                    profile_data = await self.scrape_profile(page, username)
                    if profile_data:
                        profile_data['source'] = 'hashtag'
                        results.append(profile_data)
                        logger.info(f"Scraped profile: @{username}")
                    
                    # Rate limiting
                    await page.wait_for_timeout(random.randint(2000, 4000))
                
                await browser.close()
                
        except Exception as e:
            error_msg = f"Error scraping hashtag {hashtag}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
        
        return results
    
    async def scrape_keyword(self, keyword: str, max_profiles: int = 20) -> List[Dict]:
        """Scrape profiles based on keyword search"""
        results = []
        
        try:
            async with async_playwright() as p:
                # Launch browser without proxy for reliability
                browser = await p.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-setuid-sandbox']
                )
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                page = await context.new_page()
                
                # Login if account available
                account = self.get_next_account()
                if account:
                    logged_in = await self.login_instagram(page, account)
                    if not logged_in:
                        logger.warning("Proceeding without login")
                
                # Use search - this requires login typically
                await page.goto('https://www.instagram.com/', wait_until='networkidle', timeout=30000)
                await page.wait_for_timeout(random.randint(2000, 4000))
                
                # Try to find and use search
                search_input = await page.query_selector('input[placeholder*="Search"]')
                if search_input:
                    await search_input.fill(keyword)
                    await page.wait_for_timeout(random.randint(2000, 4000))
                    
                    # Get search results
                    result_links = await page.query_selector_all('a[href*="/"]')
                    
                    usernames_found = set()
                    for link in result_links[:max_profiles * 2]:
                        href = await link.get_attribute('href')
                        if href and href.startswith('/') and '/p/' not in href and '/explore/' not in href:
                            username = href.strip('/').split('/')[0]
                            if username and len(username) > 0 and username not in ['accounts', 'explore', 'reels', 'direct']:
                                usernames_found.add(username)
                    
                    # Scrape profiles
                    for username in list(usernames_found)[:max_profiles]:
                        profile_data = await self.scrape_profile(page, username)
                        if profile_data:
                            profile_data['source'] = 'keyword'
                            results.append(profile_data)
                        
                        await page.wait_for_timeout(random.randint(2000, 4000))
                
                await browser.close()
                
        except Exception as e:
            logger.error(f"Error scraping keyword {keyword}: {str(e)}")
        
        return results

# ===================== API ENDPOINTS =====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "scraper"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_instagram(request: ScrapeRequest):
    """Main scraping endpoint"""
    logger.info(f"Received scrape request: {len(request.keywords)} keywords, {len(request.hashtags)} hashtags")
    
    accounts = [acc.model_dump() for acc in request.accounts]
    proxies = [proxy.model_dump() for proxy in request.proxies]
    
    scraper = InstagramScraper(accounts, proxies)
    
    all_leads = []
    errors = []
    
    # Scrape hashtags
    for hashtag in request.hashtags:
        try:
            leads = await scraper.scrape_hashtag(hashtag, max_profiles=request.max_profiles)
            all_leads.extend(leads)
            logger.info(f"Hashtag {hashtag}: found {len(leads)} leads")
        except Exception as e:
            error_msg = f"Error scraping hashtag {hashtag}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
    
    # Scrape keywords
    for keyword in request.keywords:
        try:
            leads = await scraper.scrape_keyword(keyword, max_profiles=request.max_profiles)
            all_leads.extend(leads)
            logger.info(f"Keyword {keyword}: found {len(leads)} leads")
        except Exception as e:
            error_msg = f"Error scraping keyword {keyword}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
    
    # Remove duplicates by username
    seen_usernames = set()
    unique_leads = []
    for lead in all_leads:
        if lead['username'] not in seen_usernames:
            seen_usernames.add(lead['username'])
            unique_leads.append(LeadResult(**lead))
    
    # Limit to max_profiles
    unique_leads = unique_leads[:request.max_profiles]
    
    return ScrapeResponse(
        success=len(errors) == 0,
        leads=unique_leads,
        total_found=len(unique_leads),
        errors=errors
    )

@app.post("/scrape/hashtag")
async def scrape_hashtag_only(hashtag: str, max_profiles: int = 20, accounts: List[AccountConfig] = [], proxies: List[ProxyConfig] = []):
    """Scrape a single hashtag"""
    accounts_dict = [acc.model_dump() for acc in accounts]
    proxies_dict = [proxy.model_dump() for proxy in proxies]
    
    scraper = InstagramScraper(accounts_dict, proxies_dict)
    leads = await scraper.scrape_hashtag(hashtag, max_profiles)
    
    return {
        "success": True,
        "hashtag": hashtag,
        "leads": [LeadResult(**lead) for lead in leads],
        "total_found": len(leads)
    }

@app.post("/scrape/keyword")
async def scrape_keyword_only(keyword: str, max_profiles: int = 20, accounts: List[AccountConfig] = [], proxies: List[ProxyConfig] = []):
    """Scrape a single keyword"""
    accounts_dict = [acc.model_dump() for acc in accounts]
    proxies_dict = [proxy.model_dump() for proxy in proxies]
    
    scraper = InstagramScraper(accounts_dict, proxies_dict)
    leads = await scraper.scrape_keyword(keyword, max_profiles)
    
    return {
        "success": True,
        "keyword": keyword,
        "leads": [LeadResult(**lead) for lead in leads],
        "total_found": len(leads)
    }

@app.get("/scrape/profile/{username}")
async def scrape_single_profile(username: str):
    """Scrape a single profile by username using API"""
    scraper = InstagramScraper([], [])
    result = await scraper.scrape_profile_via_api(username)
    
    if result:
        return {
            "success": True,
            "profile": LeadResult(**result)
        }
    else:
        return {
            "success": False,
            "error": f"Could not fetch profile for @{username}"
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SCRAPER_PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)
