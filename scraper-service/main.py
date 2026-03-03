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
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeadMiner Scraper Service", version="2.0.0")

# Session storage path
SESSION_DIR = "/tmp/instagram_sessions"
os.makedirs(SESSION_DIR, exist_ok=True)

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

# ===================== HUMAN-LIKE SCRAPER CLASS =====================

class HumanLikeScraper:
    """Instagram scraper with human-like behavior to avoid detection"""
    
    def __init__(self, accounts: List[Dict], proxies: List[Dict]):
        self.accounts = accounts
        self.proxies = proxies
        self.current_account_index = 0
        self.browser = None
        self.context = None
        self.page = None
    
    def get_next_account(self) -> Optional[Dict]:
        """Get next available account"""
        available = [acc for acc in self.accounts if acc.get('status') == 'active']
        if not available:
            return None
        self.current_account_index = (self.current_account_index + 1) % len(available)
        return available[self.current_account_index]
    
    def get_next_proxy(self) -> Optional[Dict]:
        """Get next available proxy"""
        available = [p for p in self.proxies if p.get('status') == 'active']
        if not available:
            return None
        return available[0]  # Return first active proxy
    
    def get_session_file(self, username: str) -> str:
        """Get session file path for an account"""
        return os.path.join(SESSION_DIR, f"{username}_session.json")
    
    async def human_delay(self, min_sec: float = 1.0, max_sec: float = 3.0):
        """Random delay to simulate human behavior"""
        delay = random.uniform(min_sec, max_sec)
        await asyncio.sleep(delay)
    
    async def human_type(self, element, text: str):
        """Type text like a human - character by character with random delays"""
        for char in text:
            await element.type(char, delay=random.randint(50, 150))
            if random.random() < 0.1:  # 10% chance of small pause
                await asyncio.sleep(random.uniform(0.1, 0.3))
    
    async def human_scroll(self, page, times: int = 3):
        """Scroll like a human - gradual scrolling with pauses"""
        for _ in range(times):
            # Scroll down gradually
            scroll_amount = random.randint(300, 600)
            await page.evaluate(f'window.scrollBy(0, {scroll_amount})')
            await self.human_delay(1.5, 3.0)
            
            # Sometimes scroll up a bit (human behavior)
            if random.random() < 0.2:
                await page.evaluate(f'window.scrollBy(0, -{random.randint(50, 150)})')
                await self.human_delay(0.5, 1.0)
    
    async def move_mouse_randomly(self, page):
        """Move mouse randomly to simulate human presence"""
        try:
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y)
        except:
            pass
    
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
        
        # Phone patterns (including Brazilian formats)
        phone_patterns = [
            r'\+?\d{1,3}?[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}',
            r'\(\d{2}\)\s*\d{4,5}-?\d{4}',
            r'\d{2}\s*\d{4,5}\s*\d{4}',
        ]
        
        for pattern in phone_patterns:
            phone_match = re.search(pattern, bio)
            if phone_match:
                phone = phone_match.group(0)
                break
        
        return {'email': email, 'phone': phone}
    
    async def setup_browser(self, proxy: Optional[Dict] = None):
        """Setup browser with stealth settings"""
        playwright = await async_playwright().start()
        
        browser_args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
        ]
        
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=browser_args
        )
        
        # Create context with realistic settings
        context_options = {
            'viewport': {'width': 1366, 'height': 768},
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'locale': 'pt-BR',
            'timezone_id': 'America/Sao_Paulo',
        }
        
        if proxy:
            context_options['proxy'] = {
                'server': f"http://{proxy['host']}:{proxy['port']}",
            }
            if proxy.get('username'):
                context_options['proxy']['username'] = proxy['username']
                context_options['proxy']['password'] = proxy.get('password', '')
        
        self.context = await self.browser.new_context(**context_options)
        
        # Add stealth scripts
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            Object.defineProperty(navigator, 'languages', {get: () => ['pt-BR', 'pt', 'en-US', 'en']});
        """)
        
        self.page = await self.context.new_page()
        return self.page
    
    async def login_instagram(self, account: Dict) -> bool:
        """Login to Instagram with human-like behavior"""
        try:
            session_file = self.get_session_file(account['username'])
            
            # First, try going to Instagram to check if already logged in
            logger.info("Navigating to Instagram homepage...")
            await self.page.goto('https://www.instagram.com/', timeout=30000)
            await self.human_delay(4, 6)
            
            # Check current URL
            current_url = self.page.url
            logger.info(f"Current URL: {current_url}")
            
            # If not on login page, we might be logged in - verify by going to explore
            if '/accounts/login' not in current_url:
                # Try to access a page that requires login
                await self.page.goto('https://www.instagram.com/explore/', timeout=30000)
                await self.human_delay(3, 5)
                
                if '/accounts/login' not in self.page.url:
                    logger.info("Already logged in! Session verified.")
                    # Save current cookies
                    cookies = await self.context.cookies()
                    with open(session_file, 'w') as f:
                        json.dump(cookies, f)
                    return True
                else:
                    logger.info("Session invalid, need to login")
            
            # Need to perform login
            logger.info("Going to login page...")
            await self.page.goto('https://www.instagram.com/accounts/login/', timeout=30000)
            await self.human_delay(4, 6)
            
            # Wait for page to load
            await self.page.wait_for_load_state('domcontentloaded', timeout=30000)
            await self.human_delay(2, 4)
            
            # Find username input - try multiple selectors
            username_selectors = [
                'input[name="username"]',
                'input[aria-label*="username"]',
                'input[aria-label*="Phone"]',
                'input[aria-label*="email"]',
                'input[autocomplete="username"]',
            ]
            
            username_input = None
            for selector in username_selectors:
                try:
                    username_input = await self.page.wait_for_selector(selector, timeout=5000, state='visible')
                    if username_input:
                        logger.info(f"Found username input with selector: {selector}")
                        break
                except:
                    continue
            
            if not username_input:
                logger.error("Could not find username input")
                # Save screenshot for debugging
                await self.page.screenshot(path='/tmp/login_debug.png')
                return False
            
            # Click on input first (human behavior)
            await username_input.click()
            await self.human_delay(0.5, 1.0)
            
            # Type username slowly
            logger.info(f"Typing username: {account['username']}")
            await self.human_type(username_input, account['username'])
            await self.human_delay(1, 2)
            
            # Find and fill password
            password_selectors = [
                'input[name="password"]',
                'input[aria-label*="Password"]',
                'input[aria-label*="Senha"]',
                'input[type="password"]',
            ]
            
            password_input = None
            for selector in password_selectors:
                try:
                    password_input = await self.page.wait_for_selector(selector, timeout=5000, state='visible')
                    if password_input:
                        break
                except:
                    continue
            
            if password_input:
                await password_input.click()
                await self.human_delay(0.5, 1.0)
                logger.info("Typing password...")
                await self.human_type(password_input, account['password'])
                await self.human_delay(1, 2)
            
            # Move mouse before clicking submit
            await self.move_mouse_randomly(self.page)
            await self.human_delay(0.5, 1.0)
            
            # Find and click submit button
            submit_selectors = [
                'button[type="submit"]',
                'button:has-text("Log in")',
                'button:has-text("Entrar")',
                'div[role="button"]:has-text("Log in")',
            ]
            
            for selector in submit_selectors:
                try:
                    submit_btn = await self.page.query_selector(selector)
                    if submit_btn:
                        logger.info("Clicking login button...")
                        await submit_btn.click()
                        break
                except:
                    continue
            
            # Wait for login to complete
            logger.info("Waiting for login to complete...")
            await self.human_delay(8, 12)
            
            # Check result
            current_url = self.page.url
            logger.info(f"Current URL after login: {current_url}")
            
            if 'challenge' in current_url:
                logger.warning("Instagram is requesting verification!")
                return False
            
            if '/accounts/login' not in current_url:
                logger.info("Login successful!")
                
                # Save session cookies
                cookies = await self.context.cookies()
                with open(session_file, 'w') as f:
                    json.dump(cookies, f)
                logger.info(f"Session saved for {account['username']}")
                
                return True
            
            logger.warning("Login may have failed")
            return False
            
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return False
    
    async def scrape_profile(self, username: str) -> Optional[Dict]:
        """Scrape a single Instagram profile with human-like behavior"""
        try:
            logger.info(f"Scraping profile: @{username}")
            
            # Navigate to profile
            await self.page.goto(f'https://www.instagram.com/{username}/', timeout=30000)
            await self.human_delay(3, 5)
            
            # Check if redirected to login
            if '/accounts/login' in self.page.url:
                logger.warning(f"Login required to view @{username}")
                return {
                    'username': username,
                    'name': None,
                    'bio': None,
                    'email': None,
                    'phone': None,
                    'profile_url': f'https://instagram.com/{username}',
                    'followers': None,
                }
            
            # Move mouse
            await self.move_mouse_randomly(self.page)
            
            # Check if profile exists
            page_title = await self.page.title()
            if 'Page Not Found' in page_title:
                logger.info(f"Profile @{username} not found")
                return None
            
            # Wait for content to load
            await self.page.wait_for_load_state('domcontentloaded', timeout=20000)
            await self.human_delay(2, 3)
            
            result = {
                'username': username,
                'name': None,
                'bio': None,
                'email': None,
                'phone': None,
                'profile_url': f'https://instagram.com/{username}',
                'followers': None,
            }
            
            # Get page text content for analysis
            try:
                body_text = await self.page.inner_text('body')
                
                # Try to extract followers from text (e.g., "1,234 followers" or "1.234 seguidores")
                import re
                followers_patterns = [
                    r'([\d,.]+[KMkm]?)\s*(?:followers|seguidores)',
                    r'(?:followers|seguidores)\s*([\d,.]+[KMkm]?)',
                ]
                
                for pattern in followers_patterns:
                    match = re.search(pattern, body_text, re.IGNORECASE)
                    if match:
                        followers_str = match.group(1).replace(',', '').replace('.', '')
                        if 'K' in followers_str.upper():
                            result['followers'] = int(float(followers_str.upper().replace('K', '')) * 1000)
                        elif 'M' in followers_str.upper():
                            result['followers'] = int(float(followers_str.upper().replace('M', '')) * 1000000)
                        else:
                            try:
                                result['followers'] = int(followers_str)
                            except:
                                pass
                        break
            except Exception as e:
                logger.debug(f"Error extracting from body text: {e}")
            
            # Try to extract name from header
            try:
                # Multiple selectors for name
                name_selectors = [
                    'header section span',
                    'header h2',
                    'span[style*="font-weight"]',
                ]
                for selector in name_selectors:
                    name_elem = await self.page.query_selector(selector)
                    if name_elem:
                        name_text = await name_elem.inner_text()
                        if name_text and len(name_text) < 100:
                            result['name'] = name_text.strip()
                            break
            except:
                pass
            
            # Try to extract bio
            try:
                bio_selectors = [
                    'header section div > span',
                    'div.-vDIg span',
                    'header section span:not(:first-child)',
                ]
                for selector in bio_selectors:
                    bio_elem = await self.page.query_selector(selector)
                    if bio_elem:
                        bio_text = await bio_elem.inner_text()
                        if bio_text and len(bio_text) > 5:
                            result['bio'] = bio_text.strip()
                            contact = self.extract_contact_info(bio_text)
                            result['email'] = contact['email']
                            result['phone'] = contact['phone']
                            break
            except:
                pass
            
            # Try to extract followers count
            try:
                followers_selectors = [
                    'a[href*="followers"] span',
                    'li:has-text("followers") span',
                    'span:has-text("seguidores")',
                ]
                for selector in followers_selectors:
                    followers_elem = await self.page.query_selector(selector)
                    if followers_elem:
                        followers_text = await followers_elem.inner_text()
                        # Parse count
                        followers_text = followers_text.replace(',', '').replace('.', '').strip()
                        if 'K' in followers_text or 'k' in followers_text:
                            result['followers'] = int(float(followers_text.replace('K', '').replace('k', '').replace('mil', '')) * 1000)
                        elif 'M' in followers_text or 'm' in followers_text:
                            result['followers'] = int(float(followers_text.replace('M', '').replace('m', '')) * 1000000)
                        else:
                            try:
                                # Extract just numbers
                                nums = re.findall(r'\d+', followers_text)
                                if nums:
                                    result['followers'] = int(nums[0])
                            except:
                                pass
                        break
            except:
                pass
            
            # Simulate reading the profile
            await self.human_scroll(self.page, times=1)
            await self.human_delay(1, 2)
            
            logger.info(f"Scraped @{username}: name={result['name']}, followers={result['followers']}")
            return result
            
        except Exception as e:
            logger.error(f"Error scraping profile @{username}: {str(e)}")
            return None
    
    async def scrape_hashtag(self, hashtag: str, max_profiles: int = 20) -> List[Dict]:
        """Scrape profiles from a hashtag with human-like behavior"""
        results = []
        
        try:
            hashtag_clean = hashtag.replace('#', '').strip()
            url = f"https://www.instagram.com/explore/tags/{hashtag_clean}/"
            
            logger.info(f"Navigating to hashtag: #{hashtag_clean}")
            await self.page.goto(url, timeout=30000)
            await self.human_delay(4, 6)
            
            # Wait for page to load
            await self.page.wait_for_load_state('networkidle', timeout=30000)
            
            # Log current URL (Instagram might redirect)
            current_url = self.page.url
            logger.info(f"Current URL: {current_url}")
            
            # Check if we need to login
            if '/accounts/login' in current_url:
                logger.warning("Need to login to view hashtag")
                return results
            
            # Scroll to load more content
            logger.info("Scrolling to load content...")
            await self.human_scroll(self.page, times=5)
            
            usernames_found = set()
            
            # Get all links from the page
            all_links = await self.page.query_selector_all('a')
            logger.info(f"Found {len(all_links)} total links")
            
            # Extract usernames from different link patterns
            for link in all_links:
                if len(usernames_found) >= max_profiles * 2:
                    break
                
                try:
                    href = await link.get_attribute('href')
                    if not href:
                        continue
                    
                    # Pattern 1: Direct profile links (e.g., /username/)
                    if href.startswith('/') and '/' in href[1:]:
                        parts = href.strip('/').split('/')
                        if len(parts) == 1:  # Direct profile link
                            username = parts[0]
                            if self._is_valid_username(username):
                                usernames_found.add(username)
                                logger.info(f"Found profile link: @{username}")
                    
                    # Pattern 2: Reel links (e.g., /reel/ABC123/)
                    if '/reel/' in href:
                        # Visit reel to get username
                        reel_url = f"https://www.instagram.com{href}" if href.startswith('/') else href
                        await self.page.goto(reel_url, timeout=20000)
                        await self.human_delay(2, 4)
                        
                        # Find username in reel page
                        username = await self._extract_username_from_page()
                        if username and self._is_valid_username(username):
                            usernames_found.add(username)
                            logger.info(f"Found username from reel: @{username}")
                        
                        # Go back to hashtag page
                        await self.page.goto(url, timeout=20000)
                        await self.human_delay(2, 3)
                    
                    # Pattern 3: Post links (e.g., /p/ABC123/)
                    if '/p/' in href:
                        post_url = f"https://www.instagram.com{href}" if href.startswith('/') else href
                        await self.page.goto(post_url, timeout=20000)
                        await self.human_delay(2, 4)
                        
                        username = await self._extract_username_from_page()
                        if username and self._is_valid_username(username):
                            usernames_found.add(username)
                            logger.info(f"Found username from post: @{username}")
                        
                        await self.page.goto(url, timeout=20000)
                        await self.human_delay(2, 3)
                        
                except Exception as e:
                    logger.debug(f"Error processing link: {e}")
                    continue
            
            logger.info(f"Collected {len(usernames_found)} unique usernames")
            
            # Scrape each profile
            for username in list(usernames_found)[:max_profiles]:
                profile_data = await self.scrape_profile(username)
                if profile_data:
                    profile_data['source'] = 'hashtag'
                    results.append(profile_data)
                
                # Random delay between profiles
                await self.human_delay(3, 6)
            
        except Exception as e:
            logger.error(f"Error scraping hashtag #{hashtag}: {str(e)}")
        
        return results
    
    def _is_valid_username(self, username: str) -> bool:
        """Check if a string is a valid Instagram username"""
        if not username:
            return False
        
        # List of reserved/invalid paths
        invalid = [
            'p', 'reel', 'reels', 'explore', 'stories', 'accounts', 
            'about', 'direct', 'popular', 'legal', 'privacy', 
            'accounts/emailsignup', 'legal/privacy', 'tags'
        ]
        
        if username.lower() in invalid:
            return False
        
        # Must be alphanumeric with underscores and dots
        if not re.match(r'^[a-zA-Z0-9_.]+$', username):
            return False
        
        # Must be reasonable length
        if len(username) < 2 or len(username) > 30:
            return False
        
        return True
    
    async def _extract_username_from_page(self) -> Optional[str]:
        """Extract username from current post/reel page"""
        try:
            # Multiple selectors to find username
            selectors = [
                'header a[href^="/"]',
                'a[role="link"][tabindex="0"]',
                'span a[href^="/"]',
                'div[role="button"] a[href^="/"]',
            ]
            
            for selector in selectors:
                elements = await self.page.query_selector_all(selector)
                for elem in elements:
                    href = await elem.get_attribute('href')
                    if href and href.startswith('/'):
                        username = href.strip('/').split('/')[0]
                        if self._is_valid_username(username):
                            return username
        except Exception as e:
            logger.debug(f"Error extracting username: {e}")
        
        return None
        
        return results
    
    async def close(self):
        """Close browser"""
        if self.browser:
            await self.browser.close()

# ===================== API ENDPOINTS =====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "scraper", "version": "2.0.0"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_instagram(request: ScrapeRequest):
    """Main scraping endpoint with human-like behavior"""
    logger.info(f"Received scrape request: {len(request.keywords)} keywords, {len(request.hashtags)} hashtags")
    
    accounts = [acc.model_dump() for acc in request.accounts]
    proxies = [proxy.model_dump() for proxy in request.proxies]
    
    scraper = HumanLikeScraper(accounts, proxies)
    all_leads = []
    errors = []
    
    try:
        # Setup browser with proxy if available
        proxy = scraper.get_next_proxy() if proxies else None
        if proxy:
            logger.info(f"Using proxy: {proxy['host']}:{proxy['port']}")
        await scraper.setup_browser(proxy=proxy)
        
        # Login if account available
        account = scraper.get_next_account()
        if account:
            logged_in = await scraper.login_instagram(account)
            if not logged_in:
                logger.warning("Could not login, some features may be limited")
        
        # Scrape hashtags
        for hashtag in request.hashtags:
            try:
                leads = await scraper.scrape_hashtag(hashtag, max_profiles=request.max_profiles)
                all_leads.extend(leads)
                logger.info(f"Hashtag #{hashtag}: found {len(leads)} leads")
            except Exception as e:
                error_msg = f"Error scraping hashtag {hashtag}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        # Remove duplicates
        seen_usernames = set()
        unique_leads = []
        for lead in all_leads:
            if lead['username'] not in seen_usernames:
                seen_usernames.add(lead['username'])
                unique_leads.append(LeadResult(**lead))
        
        unique_leads = unique_leads[:request.max_profiles]
        
        return ScrapeResponse(
            success=len(unique_leads) > 0,
            leads=unique_leads,
            total_found=len(unique_leads),
            errors=errors
        )
        
    finally:
        await scraper.close()

@app.get("/scrape/profile/{username}")
async def scrape_single_profile(username: str):
    """Scrape a single profile by username"""
    scraper = HumanLikeScraper([], [])
    
    try:
        await scraper.setup_browser()
        result = await scraper.scrape_profile(username)
        
        if result:
            return {
                "success": True,
                "profile": LeadResult(**result, source="direct")
            }
        else:
            return {
                "success": False,
                "error": f"Could not fetch profile for @{username}"
            }
    finally:
        await scraper.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SCRAPER_PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)
