from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Set
from playwright.async_api import async_playwright
import asyncio
import random
import re
import logging
import os
import json
import time
import unicodedata
import traceback
from bs4 import BeautifulSoup


def _normalize_text(s: str) -> str:
    """Normalize for comparison: lowercase, strip, remove accents."""
    if not s:
        return ""
    s = s.strip().lower()
    nfd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def _lead_matches_location(lead: dict, location: str) -> bool:
    """True if the lead's bio or name contains the location (case/accent insensitive)."""
    if not location or not location.strip():
        return True
    loc_norm = _normalize_text(location)
    bio = (lead.get("bio") or "").strip()
    name = (lead.get("name") or "").strip()
    combined = f"{name} {bio}"
    combined_norm = _normalize_text(combined)
    # Match if full location string or any token (e.g. "São Paulo, Brasil" -> match "sao paulo" or "brasil")
    if loc_norm in combined_norm:
        return True
    for token in loc_norm.split():
        if len(token) >= 2 and token in combined_norm:
            return True
    return False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class _HealthEndpointFilter(logging.Filter):
    """Filtro que evita registrar GET /health no access log (reduz ruído)."""
    def filter(self, record: logging.LogRecord) -> bool:
        # uvicorn.access usa record.args como (client_addr, method, path, ...)
        if getattr(record, "args", None) and len(record.args) >= 3:
            path = record.args[2] if isinstance(record.args[2], str) else ""
            if path.split("?")[0].rstrip("/") == "/health":
                return False
        return True


# Aplicar ao carregar o módulo (vale para python main.py e uvicorn main:app)
logging.getLogger("uvicorn.access").addFilter(_HealthEndpointFilter())

app = FastAPI(title="LeadMiner Scraper Service", version="3.0.0")

# Session storage path
SESSION_DIR = "/tmp/scraper_sessions"
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
    location: Optional[str] = None
    max_profiles: int = 20
    exclude_usernames: Optional[List[str]] = None
    accounts: List[AccountConfig] = []
    proxies: List[ProxyConfig] = []
    platform: str = "instagram"  # "instagram", "tiktok", "linkedin", "facebook"

class LeadResult(BaseModel):
    username: str
    name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    profile_image_url: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    profile_url: str
    followers: Optional[int] = None
    following: Optional[int] = None
    posts: Optional[int] = None
    likes: Optional[int] = None
    videos: Optional[int] = None
    source: str = "hashtag"
    platform: str = "instagram"

class ScrapeResponse(BaseModel):
    success: bool
    leads: List[LeadResult]
    total_found: int
    platform: str = "instagram"
    errors: List[str] = []

# ===================== TIKTOK SCRAPER CLASS =====================

class TikTokScraper:
    """TikTok scraper with human-like behavior"""
    
    def __init__(self, proxies: List[Dict]):
        self.proxies = proxies
        self.browser = None
        self.context = None
        self.page = None
    
    def get_proxy(self) -> Optional[Dict]:
        """Get available proxy"""
        available = [p for p in self.proxies if p.get('status') == 'active']
        return available[0] if available else None
    
    async def human_delay(self, min_sec: float = 1.0, max_sec: float = 3.0):
        """Random delay to simulate human behavior"""
        delay = random.uniform(min_sec, max_sec)
        await asyncio.sleep(delay)
    
    async def human_scroll(self, page, times: int = 3):
        """Scroll like a human"""
        for _ in range(times):
            scroll_amount = random.randint(300, 600)
            await page.evaluate(f'window.scrollBy(0, {scroll_amount})')
            await self.human_delay(1.5, 3.0)
    
    def extract_contact_info(self, bio: str) -> Dict[str, Optional[str]]:
        """Extract email, phone and website from bio"""
        email = None
        phone = None
        website = None

        if not bio:
            return {'email': None, 'phone': None, 'website': None}

        # Email
        m = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', bio, re.IGNORECASE)
        if m:
            email = m.group(0)

        # Phone
        phone_patterns = [
            r'(?:\+\d{1,3}\s*)?\(?\d{2,3}\)?\s*[-.\s]?\d{4,5}[-.\s]?\d{4}',
            r'\b\d{10,11}\b',
        ]
        for pattern in phone_patterns:
            m = re.search(pattern, bio)
            if m and len(re.sub(r'\D', '', m.group(0))) >= 10:
                phone = m.group(0).strip()
                break

        # Website
        social = ['instagram.com', 'tiktok.com', 'facebook.com', 'twitter.com', 'youtube.com', 'wa.me', 'x.com']
        url_m = re.search(r'https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s,)]*)?', bio)
        if url_m:
            url = url_m.group(0).rstrip('.,;:)')
            if not any(x in url.lower() for x in social):
                website = url

        return {'email': email, 'phone': phone, 'website': website}
    
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
        
        # Stealth scripts
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
        """)
        
        self.page = await self.context.new_page()
        if proxy:
            await self._block_heavy_resources()
        return self.page
    
    async def _block_heavy_resources(self):
        """Block images, media and fonts to save proxy bandwidth (HTML/JS/XHR still load)."""
        async def handle_route(route):
            resource_type = route.request.resource_type
            if resource_type in ("image", "media", "font"):
                await route.abort()
            else:
                await route.continue_()
        await self.page.route("**/*", handle_route)
        logger.info("Proxy data-saver: blocking image, media and font requests")
    
    async def scrape_profile(self, username: str) -> Optional[Dict]:
        """Scrape a TikTok profile"""
        try:
            logger.info(f"Scraping TikTok profile: @{username}")
            
            url = f"https://www.tiktok.com/@{username}"
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(3, 5)
            
            # Wait for content (avoid networkidle to save proxy data)
            await self.page.wait_for_load_state('domcontentloaded')
            try:
                await self.page.wait_for_selector('script#__UNIVERSAL_DATA_FOR_REHYDRATION__, script#SIGI_STATE', timeout=15000)
            except Exception:
                pass
            
            result = {
                'username': username,
                'name': None,
                'bio': None,
                'email': None,
                'phone': None,
                'website': None,
                'profile_image_url': None,
                'location': None,
                'address': None,
                'profile_url': url,
                'followers': None,
                'following': None,
                'likes': None,
                'videos': None,
                'platform': 'tiktok'
            }
            
            # Try to extract data from JSON script tag
            content = await self.page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            # Look for the data script
            script = soup.find('script', id='__UNIVERSAL_DATA_FOR_REHYDRATION__')
            if not script:
                script = soup.find('script', id='SIGI_STATE')
            
            if script and script.string:
                try:
                    data = json.loads(script.string)
                    
                    # Navigate to user data (TikTok page structure varies by region/version)
                    user_data = None
                    stats = {}
                    
                    if '__DEFAULT_SCOPE__' in data:
                        user_detail = data.get('__DEFAULT_SCOPE__', {}).get('webapp.user-detail', {})
                        user_data = user_detail.get('userInfo', {}).get('user', {})
                        stats = user_detail.get('userInfo', {}).get('stats', {}) or {}
                    if not user_data and 'UserModule' in data:
                        users = data.get('UserModule', {}).get('users', {})
                        if isinstance(users, dict):
                            for v in users.values():
                                if isinstance(v, dict) and (v.get('uniqueId') == username or v.get('nickname')):
                                    user_data = v
                                    break
                            if not user_data and users:
                                user_data = list(users.values())[0]
                        stats = data.get('UserModule', {}).get('stats', {})
                        if isinstance(stats, dict) and stats:
                            stats = list(stats.values())[0] if stats else {}
                    if not user_data and 'ItemModule' in data:
                        item_module = data.get('ItemModule', {})
                        for _id, item in (list(item_module.items())[:5] if isinstance(item_module, dict) else []):
                            author = (item or {}).get('author') if isinstance(item, dict) else None
                            if author and (author == username or (isinstance(author, dict) and author.get('uniqueId') == username)):
                                user_data = author if isinstance(author, dict) else {'uniqueId': author, 'nickname': author}
                                break
                    
                    if user_data:
                        if isinstance(user_data, str):
                            user_data = {'uniqueId': user_data, 'nickname': user_data}
                        result['name'] = user_data.get('nickname') or user_data.get('uniqueId') or username
                        result['bio'] = user_data.get('signature') or user_data.get('bio', '') or ''

                        # Profile image
                        avatar = user_data.get('avatarLarger') or user_data.get('avatarMedium') or user_data.get('avatarThumb')
                        if avatar:
                            result['profile_image_url'] = avatar

                        # Website / bioLink
                        bio_link = user_data.get('bioLink', {})
                        if isinstance(bio_link, dict) and bio_link.get('link'):
                            result['website'] = bio_link['link']

                        # Region / location
                        region = user_data.get('region') or user_data.get('country')
                        if region:
                            result['location'] = region

                        # Extract contact info from bio
                        if result['bio']:
                            contact = self.extract_contact_info(result['bio'])
                            result['email'] = result['email'] or contact.get('email')
                            result['phone'] = result['phone'] or contact.get('phone')
                            if not result.get('website'):
                                result['website'] = contact.get('website')

                        # Stats (can be dict or nested)
                        if stats and isinstance(stats, dict):
                            result['followers'] = stats.get('followerCount') or stats.get('followers')
                            result['following'] = stats.get('followingCount') or stats.get('following')
                            result['likes'] = stats.get('heartCount') or stats.get('heart')
                            result['videos'] = stats.get('videoCount') or stats.get('videos')

                        logger.info(f"TikTok @{username}: {result['name']}, {result['followers']} followers")
                        return result
                        
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {e}")
            
            # Fallback: Try to extract from page text
            try:
                body_text = await self.page.inner_text('body')
                
                # Try to find followers count
                followers_match = re.search(r'([\d.]+[KMB]?)\s*(?:Followers|Seguidores)', body_text, re.IGNORECASE)
                if followers_match:
                    followers_str = followers_match.group(1).replace(',', '')
                    if 'K' in followers_str.upper():
                        result['followers'] = int(float(followers_str.upper().replace('K', '')) * 1000)
                    elif 'M' in followers_str.upper():
                        result['followers'] = int(float(followers_str.upper().replace('M', '')) * 1000000)
                    elif 'B' in followers_str.upper():
                        result['followers'] = int(float(followers_str.upper().replace('B', '')) * 1000000000)
                    else:
                        result['followers'] = int(float(followers_str))
                
                return result
                
            except Exception as e:
                logger.error(f"Fallback extraction failed: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error scraping TikTok profile @{username}: {str(e)}")
            return None
    
    async def scrape_hashtag(
        self,
        hashtag: str,
        max_profiles: int = 20,
        exclude_usernames: Optional[Set[str]] = None,
    ) -> List[Dict]:
        """Scrape profiles from a TikTok hashtag. Continua até ter max_profiles leads novos (exclui exclude_usernames)."""
        results = []
        exclude = exclude_usernames or set()
        scraped_in_run: Set[str] = set()
        scroll_retries = 5
        try:
            hashtag_clean = hashtag.replace('#', '').strip()
            urls_to_try = [
                f"https://www.tiktok.com/discover/{hashtag_clean}",
                f"https://www.tiktok.com/tag/{hashtag_clean}",
            ]
            url = urls_to_try[0]
            logger.info(f"Navigating to TikTok hashtag: #{hashtag_clean} (exclude={len(exclude)})")
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(4, 6)

            for retry in range(scroll_retries):
                if len(results) >= max_profiles:
                    break
                logger.info("Scrolling to load videos...")
                await self.human_scroll(self.page, times=5)
                links = await self.page.query_selector_all('a[href*="/@"]')
                if retry == 0 and not links and len(urls_to_try) > 1:
                    url = urls_to_try[1]
                    await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
                    await self.human_delay(3, 5)
                    await self.human_scroll(self.page, times=4)
                    links = await self.page.query_selector_all('a[href*="/@"]')

                usernames_found = set()
                for link in links:
                    try:
                        href = await link.get_attribute('href')
                        if href and '/@' in href:
                            match = re.search(r'/@([^/?]+)', href)
                            if match:
                                u = match.group(1)
                                if u and not any(x in u.lower() for x in ['tag', 'music', 'search', 'foryou', 'following']):
                                    usernames_found.add(u)
                    except Exception:
                        continue

                need = max_profiles - len(results)
                logger.info(f"TikTok #{hashtag_clean} round {retry+1}: {len(usernames_found)} usernames, need {need} more new leads")
                for username in usernames_found:
                    if len(results) >= max_profiles:
                        break
                    if username in exclude or username in scraped_in_run:
                        continue
                    scraped_in_run.add(username)
                    profile_data = await self.scrape_profile(username)
                    if profile_data:
                        profile_data['source'] = 'hashtag'
                        results.append(profile_data)
                        logger.info(f"TikTok new lead: @{username} ({len(results)}/{max_profiles})")
                    await self.human_delay(3, 6)

                if len(results) >= max_profiles:
                    break
                if retry < scroll_retries - 1:
                    await self.human_delay(3, 5)

            logger.info(f"TikTok hashtag #{hashtag_clean}: found {len(results)} leads")
        except Exception as e:
            logger.error(f"Error scraping TikTok hashtag #{hashtag}: {str(e)}")
        return results
    
    async def scrape_search(
        self,
        keyword: str,
        max_profiles: int = 20,
        exclude_usernames: Optional[Set[str]] = None,
    ) -> List[Dict]:
        """Scrape profiles from TikTok search results."""
        results = []
        exclude = exclude_usernames or set()
        try:
            url = f"https://www.tiktok.com/search/user?q={keyword}"
            logger.info(f"Searching TikTok for: {keyword}")
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(4, 6)
            await self.human_scroll(self.page, times=3)
            usernames_found = set()
            links = await self.page.query_selector_all('a[href*="/@"]')
            for link in links:
                if len(usernames_found) >= max_profiles * 2:
                    break
                try:
                    href = await link.get_attribute('href')
                    if href and '/@' in href:
                        match = re.search(r'/@([^/?]+)', href)
                        if match:
                            username = match.group(1)
                            if username and username not in usernames_found:
                                usernames_found.add(username)
                except Exception:
                    continue
            new_usernames = [u for u in list(usernames_found) if u not in exclude][:max_profiles]
            for username in new_usernames:
                profile_data = await self.scrape_profile(username)
                if profile_data:
                    profile_data['source'] = 'search'
                    results.append(profile_data)
                await self.human_delay(3, 6)
        except Exception as e:
            logger.error(f"Error searching TikTok for {keyword}: {str(e)}")
        return results
    
    async def close(self):
        """Close browser"""
        if self.browser:
            await self.browser.close()

# ===================== LINKEDIN SCRAPER CLASS =====================

class LinkedInScraper:
    """LinkedIn public profile scraper (no login required for public profiles)."""

    def __init__(self, proxies: List[Dict]):
        self.proxies = proxies
        self.browser = None
        self.context = None
        self.page = None

    def get_proxy(self) -> Optional[Dict]:
        available = [p for p in self.proxies if p.get('status') == 'active']
        return available[0] if available else None

    async def human_delay(self, min_sec: float = 1.0, max_sec: float = 3.0):
        await asyncio.sleep(random.uniform(min_sec, max_sec))

    async def human_scroll(self, page, times: int = 3):
        for _ in range(times):
            await page.evaluate(f'window.scrollBy(0, {random.randint(300, 600)})')
            await self.human_delay(1.5, 3.0)

    def extract_contact_info(self, bio: str) -> Dict[str, Optional[str]]:
        email = phone = website = None
        if not bio:
            return {'email': None, 'phone': None, 'website': None}
        m = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', bio, re.IGNORECASE)
        if m:
            email = m.group(0)
        phone_patterns = [
            r'(?:\+\d{1,3}\s*)?\(?\d{2,3}\)?\s*[-.\s]?\d{4,5}[-.\s]?\d{4}',
            r'\b\d{10,11}\b',
        ]
        for p in phone_patterns:
            m = re.search(p, bio)
            if m and len(re.sub(r'\D', '', m.group(0))) >= 10:
                phone = m.group(0).strip()
                break
        url_m = re.search(r'https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s,)]*)?', bio)
        if url_m:
            url = url_m.group(0).rstrip('.,;:)')
            if 'linkedin.com' not in url.lower():
                website = url
        return {'email': email, 'phone': phone, 'website': website}

    async def setup_browser(self, proxy: Optional[Dict] = None):
        playwright = await async_playwright().start()
        browser_args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled']
        self.browser = await playwright.chromium.launch(headless=True, args=browser_args)
        context_options = {
            'viewport': {'width': 1366, 'height': 768},
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'locale': 'pt-BR', 'timezone_id': 'America/Sao_Paulo',
        }
        if proxy:
            context_options['proxy'] = {'server': f"http://{proxy['host']}:{proxy['port']}"}
            if proxy.get('username'):
                context_options['proxy']['username'] = proxy['username']
                context_options['proxy']['password'] = proxy.get('password', '')
        self.context = await self.browser.new_context(**context_options)
        await self.context.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
        self.page = await self.context.new_page()
        return self.page

    async def scrape_profile(self, username: str) -> Optional[Dict]:
        """Scrape a public LinkedIn profile page."""
        try:
            logger.info(f"Scraping LinkedIn profile: {username}")
            url = f"https://www.linkedin.com/in/{username}/"
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(3, 5)

            result = {
                'username': username, 'name': None, 'bio': None, 'email': None,
                'phone': None, 'website': None, 'profile_image_url': None,
                'location': None, 'address': None,
                'profile_url': url, 'followers': None, 'following': None,
                'posts': None, 'platform': 'linkedin',
            }

            # Check if auth-wall blocks us
            if '/authwall' in self.page.url or '/login' in self.page.url:
                logger.warning("LinkedIn auth wall — trying public page view")
                await self.page.goto(url.rstrip('/') + '?original_referer=', wait_until='domcontentloaded', timeout=30000)
                await self.human_delay(3, 5)

            content = await self.page.content()

            # Extract from ld+json
            try:
                soup = BeautifulSoup(content, 'html.parser')
                ld_scripts = soup.find_all('script', type='application/ld+json')
                for script in ld_scripts:
                    if not script.string:
                        continue
                    try:
                        data = json.loads(script.string)
                        if isinstance(data, list):
                            data = data[0] if data else {}
                        if data.get('@type') in ('Person', 'ProfilePage'):
                            result['name'] = data.get('name')
                            if data.get('image'):
                                img = data['image']
                                result['profile_image_url'] = img.get('contentUrl') if isinstance(img, dict) else img
                            if data.get('address'):
                                addr = data['address']
                                if isinstance(addr, dict):
                                    parts = [addr.get('addressLocality', ''), addr.get('addressRegion', ''), addr.get('addressCountry', '')]
                                    result['location'] = ', '.join(p for p in parts if p)
                                elif isinstance(addr, str):
                                    result['location'] = addr
                            if data.get('description'):
                                result['bio'] = data['description']
                            break
                    except json.JSONDecodeError:
                        continue
            except Exception:
                pass

            # Fallback: DOM extraction
            if not result.get('name'):
                try:
                    h1 = await self.page.query_selector('h1')
                    if h1:
                        result['name'] = (await h1.inner_text()).strip()
                except Exception:
                    pass

            if not result.get('bio'):
                try:
                    for sel in ['section.summary div.description', '.pv-about__summary-text', 'div[class*="about"]']:
                        elem = await self.page.query_selector(sel)
                        if elem:
                            result['bio'] = (await elem.inner_text()).strip()
                            break
                except Exception:
                    pass

            if not result.get('location'):
                try:
                    loc = await self.page.query_selector('span.top-card-layout__first-subline, .top-card__subline-row span')
                    if loc:
                        result['location'] = (await loc.inner_text()).strip()
                except Exception:
                    pass

            if not result.get('profile_image_url'):
                try:
                    img = await self.page.query_selector('img.top-card__profile-image, img.pv-top-card-profile-picture__image, img[data-ghost-url]')
                    if img:
                        src = await img.get_attribute('src') or await img.get_attribute('data-ghost-url')
                        if src and src.startswith('http'):
                            result['profile_image_url'] = src
                except Exception:
                    pass

            # Contact info from bio
            if result.get('bio'):
                contact = self.extract_contact_info(result['bio'])
                result['email'] = result['email'] or contact.get('email')
                result['phone'] = result['phone'] or contact.get('phone')
                result['website'] = result['website'] or contact.get('website')

            logger.info(f"LinkedIn @{username}: name={result.get('name')}, location={result.get('location')}")
            return result
        except Exception as e:
            logger.error(f"Error scraping LinkedIn @{username}: {e}")
            return None

    async def scrape_search(self, keyword: str, max_profiles: int = 20, exclude_usernames: Optional[Set[str]] = None) -> List[Dict]:
        """Search LinkedIn for public profiles by keyword."""
        results = []
        exclude = exclude_usernames or set()
        try:
            url = f"https://www.linkedin.com/pub/dir?firstName=&lastName=&trk=people-guest_people-search-bar_search-submit&keywords={keyword}"
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(3, 5)
            await self.human_scroll(self.page, times=3)

            links = await self.page.query_selector_all('a[href*="/in/"]')
            usernames_found: Set[str] = set()
            for link in links:
                href = await link.get_attribute('href')
                if href:
                    m = re.search(r'/in/([^/?]+)', href)
                    if m:
                        u = m.group(1)
                        if u and u not in exclude and u not in usernames_found:
                            usernames_found.add(u)
                if len(usernames_found) >= max_profiles * 2:
                    break

            for u in list(usernames_found)[:max_profiles]:
                profile = await self.scrape_profile(u)
                if profile:
                    profile['source'] = 'search'
                    results.append(profile)
                await self.human_delay(3, 6)
        except Exception as e:
            logger.error(f"Error searching LinkedIn for '{keyword}': {e}")
        return results

    async def close(self):
        if self.browser:
            await self.browser.close()


# ===================== FACEBOOK SCRAPER CLASS =====================

class FacebookScraper:
    """Facebook public page/profile scraper (no login required for public pages)."""

    def __init__(self, proxies: List[Dict]):
        self.proxies = proxies
        self.browser = None
        self.context = None
        self.page = None

    def get_proxy(self) -> Optional[Dict]:
        available = [p for p in self.proxies if p.get('status') == 'active']
        return available[0] if available else None

    async def human_delay(self, min_sec: float = 1.0, max_sec: float = 3.0):
        await asyncio.sleep(random.uniform(min_sec, max_sec))

    async def human_scroll(self, page, times: int = 3):
        for _ in range(times):
            await page.evaluate(f'window.scrollBy(0, {random.randint(300, 600)})')
            await self.human_delay(1.5, 3.0)

    def extract_contact_info(self, bio: str) -> Dict[str, Optional[str]]:
        email = phone = website = None
        if not bio:
            return {'email': None, 'phone': None, 'website': None}
        m = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', bio, re.IGNORECASE)
        if m:
            email = m.group(0)
        phone_patterns = [
            r'(?:\+\d{1,3}\s*)?\(?\d{2,3}\)?\s*[-.\s]?\d{4,5}[-.\s]?\d{4}',
            r'\b\d{10,11}\b',
        ]
        for p in phone_patterns:
            m = re.search(p, bio)
            if m and len(re.sub(r'\D', '', m.group(0))) >= 10:
                phone = m.group(0).strip()
                break
        url_m = re.search(r'https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s,)]*)?', bio)
        if url_m:
            url = url_m.group(0).rstrip('.,;:)')
            if 'facebook.com' not in url.lower():
                website = url
        return {'email': email, 'phone': phone, 'website': website}

    async def setup_browser(self, proxy: Optional[Dict] = None):
        playwright = await async_playwright().start()
        browser_args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled']
        self.browser = await playwright.chromium.launch(headless=True, args=browser_args)
        context_options = {
            'viewport': {'width': 1366, 'height': 768},
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'locale': 'pt-BR', 'timezone_id': 'America/Sao_Paulo',
        }
        if proxy:
            context_options['proxy'] = {'server': f"http://{proxy['host']}:{proxy['port']}"}
            if proxy.get('username'):
                context_options['proxy']['username'] = proxy['username']
                context_options['proxy']['password'] = proxy.get('password', '')
        self.context = await self.browser.new_context(**context_options)
        await self.context.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
        self.page = await self.context.new_page()
        return self.page

    async def scrape_profile(self, page_name: str) -> Optional[Dict]:
        """Scrape a public Facebook page."""
        try:
            logger.info(f"Scraping Facebook page: {page_name}")
            url = f"https://www.facebook.com/{page_name}/"
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(3, 5)

            result = {
                'username': page_name, 'name': None, 'bio': None, 'email': None,
                'phone': None, 'website': None, 'profile_image_url': None,
                'location': None, 'address': None,
                'profile_url': url, 'followers': None, 'following': None,
                'posts': None, 'platform': 'facebook',
            }

            # Check if login wall
            if '/login' in self.page.url:
                logger.warning("Facebook login wall — profile not publicly accessible")
                return result

            content = await self.page.content()
            body_text = ""
            try:
                body_text = await self.page.inner_text('body')
            except Exception:
                pass

            # Extract from meta tags
            try:
                meta_data = await self.page.evaluate("""() => {
                    const res = {};
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    if (ogTitle) res.title = ogTitle.getAttribute('content');
                    const ogDesc = document.querySelector('meta[property="og:description"]');
                    if (ogDesc) res.description = ogDesc.getAttribute('content');
                    const ogImg = document.querySelector('meta[property="og:image"]');
                    if (ogImg) res.image = ogImg.getAttribute('content');
                    return res;
                }""")
                if meta_data:
                    if meta_data.get('title'):
                        result['name'] = meta_data['title']
                    if meta_data.get('description'):
                        result['bio'] = meta_data['description']
                    if meta_data.get('image'):
                        result['profile_image_url'] = meta_data['image']
            except Exception:
                pass

            # Try page name from h1
            if not result.get('name'):
                try:
                    h1 = await self.page.query_selector('h1')
                    if h1:
                        result['name'] = (await h1.inner_text()).strip()
                except Exception:
                    pass

            # Extract followers from body text
            if body_text:
                fm = re.search(r'([\d,.]+[KMkm]?)\s*(?:followers|seguidores|curtidas|likes)', body_text, re.IGNORECASE)
                if fm:
                    val_str = fm.group(1).replace(',', '').replace('.', '')
                    try:
                        if 'k' in val_str.lower():
                            result['followers'] = int(float(val_str.upper().replace('K', '')) * 1000)
                        elif 'm' in val_str.lower():
                            result['followers'] = int(float(val_str.upper().replace('M', '')) * 1000000)
                        else:
                            result['followers'] = int(val_str)
                    except ValueError:
                        pass

            # Extract address / location from page info
            try:
                # Facebook pages sometimes have structured data
                soup = BeautifulSoup(content, 'html.parser')
                ld_scripts = soup.find_all('script', type='application/ld+json')
                for script in ld_scripts:
                    if not script.string:
                        continue
                    try:
                        data = json.loads(script.string)
                        if isinstance(data, list):
                            data = data[0] if data else {}
                        if data.get('address'):
                            addr = data['address']
                            if isinstance(addr, dict):
                                parts = [addr.get('streetAddress', ''), addr.get('addressLocality', ''),
                                         addr.get('addressRegion', ''), addr.get('addressCountry', '')]
                                if addr.get('streetAddress'):
                                    result['address'] = addr['streetAddress']
                                result['location'] = ', '.join(p for p in parts if p)
                        if data.get('telephone'):
                            result['phone'] = data['telephone']
                        if data.get('email'):
                            result['email'] = data['email']
                        if data.get('url') and 'facebook.com' not in data['url']:
                            result['website'] = data['url']
                    except json.JSONDecodeError:
                        continue
            except Exception:
                pass

            # Contact from bio
            if result.get('bio'):
                contact = self.extract_contact_info(result['bio'])
                result['email'] = result['email'] or contact.get('email')
                result['phone'] = result['phone'] or contact.get('phone')
                result['website'] = result['website'] or contact.get('website')

            logger.info(f"Facebook @{page_name}: name={result.get('name')}, location={result.get('location')}")
            return result
        except Exception as e:
            logger.error(f"Error scraping Facebook @{page_name}: {e}")
            return None

    async def scrape_search(self, keyword: str, max_profiles: int = 20, exclude_usernames: Optional[Set[str]] = None) -> List[Dict]:
        """Search Facebook public pages."""
        results = []
        exclude = exclude_usernames or set()
        try:
            url = f"https://www.facebook.com/public/{keyword}"
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(3, 5)
            await self.human_scroll(self.page, times=3)

            links = await self.page.query_selector_all('a[href*="facebook.com/"]')
            usernames_found: Set[str] = set()
            for link in links:
                href = await link.get_attribute('href')
                if href:
                    m = re.search(r'facebook\.com/([A-Za-z0-9.]+)/?', href)
                    if m:
                        u = m.group(1)
                        skip = ['public', 'login', 'help', 'pages', 'groups', 'events', 'watch', 'marketplace', 'gaming']
                        if u and u not in exclude and u not in usernames_found and u.lower() not in skip:
                            usernames_found.add(u)
                if len(usernames_found) >= max_profiles * 2:
                    break

            for u in list(usernames_found)[:max_profiles]:
                profile = await self.scrape_profile(u)
                if profile:
                    profile['source'] = 'search'
                    results.append(profile)
                await self.human_delay(3, 6)
        except Exception as e:
            logger.error(f"Error searching Facebook for '{keyword}': {e}")
        return results

    async def close(self):
        if self.browser:
            await self.browser.close()


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
        self._last_logged_account: Optional[Dict] = None  # para re-login se hashtag redirecionar para login
    
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
        """Extract email, phone and website from bio/text. Inclui wa.me como contato."""
        email = None
        phone = None
        website = None
        if not bio:
            return {'email': None, 'phone': None, 'website': None}
        text = bio.strip()
        # Email — also handle obfuscated forms like "name [at] domain [dot] com"
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
        m = re.search(email_pattern, text, re.IGNORECASE)
        if m:
            email = m.group(0)
        if not email:
            obf = re.search(
                r'\b([A-Za-z0-9._%+-]+)\s*[\[\(]\s*(?:at|arroba)\s*[\]\)]\s*([A-Za-z0-9.-]+)\s*[\[\(]\s*(?:dot|ponto)\s*[\]\)]\s*([A-Za-z]{2,})\b',
                text, re.IGNORECASE,
            )
            if obf:
                email = f"{obf.group(1)}@{obf.group(2)}.{obf.group(3)}"
        # Telefone: (86) 99999-9999, 86999999999, +55 86..., wa.me/5586999999999
        phone_patterns = [
            r'(?:whatsapp|whats|wpp|wa|tel|fone|contato)[:\s]*\+?\(?\s*\d{2,3}\s*\)?\s*[-.\s]*\d{4,5}\s*[-.]?\s*\d{4}',
            r'[☎📱📞]\s*\+?\(?\s*\d{2,3}\s*\)?\s*[-.\s]*\d{4,5}\s*[-.]?\s*\d{4}',
            r'(?:\+55\s*)?\(?\s*0?\s*\d{2}\s*\)?\s*[-.\s]*9?\d{4}\s*[-.]?\s*\d{4}',
            r'\(?\s*\d{2}\s*\)?\s*[-.\s]*\d{4,5}\s*[-.]?\s*\d{4}',
            r'\+?\d{1,3}[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}',
            r'\b\d{10,11}\b',
        ]
        for pattern in phone_patterns:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                raw = re.sub(r'\s+', ' ', m.group(0).strip())
                digits_only = re.sub(r'\D', '', raw)
                if len(digits_only) >= 10:
                    phone = raw
                    break
        # wa.me/5586999999999 ou api.whatsapp.com/send?phone=...
        wa_match = re.search(r'(?:wa\.me/|api\.whatsapp\.com/send\?phone=)(\d{10,14})', text, re.IGNORECASE)
        if wa_match and not phone:
            phone = '+' + wa_match.group(1)
        # Site/link (http/https e short links como abrir.link, linktr.ee, bio.link)
        social_domains = ['instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com',
                          'youtube.com', 'wa.me', 'api.whatsapp', 'x.com']
        url_pattern = r'https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s,)]*)?'
        for url_match in re.finditer(url_pattern, text):
            url = url_match.group(0).rstrip('.,;:)\'\"')
            if not any(x in url.lower() for x in social_domains):
                website = url
                break
        if not website:
            short_link = re.search(r'(?:https?://)?(?:[a-zA-Z0-9-]+\.(?:link|page|co|io|me|site|bio|store))/[A-Za-z0-9._-]+', text)
            if short_link:
                candidate = short_link.group(0)
                if not any(x in candidate.lower() for x in social_domains):
                    website = candidate if candidate.startswith('http') else 'https://' + candidate
        return {'email': email, 'phone': phone, 'website': website}

    def _extract_location_from_bio(self, bio: str) -> Optional[str]:
        """Extrai cidade/região da bio. Suporta Floriano-PI, 📍São Paulo, endereços, etc."""
        if not bio or not bio.strip():
            return None
        text = bio.strip()

        BRAZILIAN_STATE_ABBRS = {
            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
            'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
            'SP', 'SE', 'TO',
        }
        STATE_NAMES = {
            'PI': 'Piauí', 'SP': 'São Paulo', 'RJ': 'Rio de Janeiro', 'MG': 'Minas Gerais',
            'BA': 'Bahia', 'PE': 'Pernambuco', 'CE': 'Ceará', 'RS': 'Rio Grande do Sul',
            'PR': 'Paraná', 'SC': 'Santa Catarina', 'GO': 'Goiás', 'AM': 'Amazonas',
            'ES': 'Espírito Santo', 'MA': 'Maranhão', 'PA': 'Pará', 'MT': 'Mato Grosso',
            'MS': 'Mato Grosso do Sul', 'DF': 'Distrito Federal', 'SE': 'Sergipe',
            'AL': 'Alagoas', 'PB': 'Paraíba', 'RN': 'Rio Grande do Norte', 'TO': 'Tocantins',
            'RO': 'Rondônia', 'RR': 'Roraima', 'AP': 'Amapá', 'AC': 'Acre',
        }

        # 1) Pin emoji + location: "📍Floriano-PI" or "📍 São Paulo, SP"
        pin = re.search(r'📍\s*([A-Za-zÀ-ÿ\s]+?)[-/,\s]+([A-Z]{2})\b', text)
        if pin:
            city = pin.group(1).strip()
            st = pin.group(2).upper()
            if st in BRAZILIAN_STATE_ABBRS and 2 <= len(city) <= 50:
                return f"{city}, {STATE_NAMES.get(st, st)}"
        # Pin + city only: "📍 Campinas"
        pin_city = re.search(r'📍\s*([A-Za-zÀ-ÿ\s]{2,40})', text)
        if pin_city:
            city = pin_city.group(1).strip()
            if not city.lower().startswith('http') and not re.match(r'^\d', city):
                return city

        # 2) City-STATE pattern: "Floriano-PI", "Belo Horizonte/MG"
        city_state = re.search(r'\b([A-Za-zÀ-ÿ\s]{2,40})[-/]\s*([A-Z]{2})\b', text)
        if city_state:
            city = city_state.group(1).strip()
            st = city_state.group(2).upper()
            if st in BRAZILIAN_STATE_ABBRS and 2 <= len(city) <= 50 and not city.lower().startswith('http'):
                return f"{city}, {STATE_NAMES.get(st, st)}"

        # 3) Full address: "Rua X, 123, Bairro, Cidade, Estado"
        addr = re.search(
            r'(?:Rua|Av\.?|Avenida|R\.)\s+[^,]+,\s*\d+[^,]*,\s*[^,]+,\s*([A-Za-zÀ-ÿ\s]+),\s*([A-Za-zÀ-ÿ\s]+)',
            text, re.IGNORECASE
        )
        if addr:
            city = addr.group(1).strip()
            state = addr.group(2).strip()
            if 2 <= len(city) <= 40 and 2 <= len(state) <= 30:
                return f"{city}, {state}"

        # 4) "em Campinas" or "de São Paulo" (only after known indicator words)
        em_match = re.search(
            r'\b(?:em|de|from|based in|located in|morando em)\s+([A-Za-zÀ-ÿ\s]{2,40})',
            text, re.IGNORECASE,
        )
        if em_match:
            loc = em_match.group(1).strip()
            if not loc.lower().startswith('http') and not re.match(r'^\d', loc) and len(loc) >= 3:
                return loc[:50]

        return None
    
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
        if proxy:
            await self._block_heavy_resources()
        return self.page
    
    async def _block_heavy_resources(self):
        """Block images, media and fonts to save proxy bandwidth (HTML/JS/XHR still load)."""
        async def handle_route(route):
            resource_type = route.request.resource_type
            if resource_type in ("image", "media", "font"):
                await route.abort()
            else:
                await route.continue_()
        await self.page.route("**/*", handle_route)
        logger.info("Proxy data-saver: blocking image, media and font requests")
    
    async def login_instagram(self, account: Dict) -> bool:
        """Login to Instagram with human-like behavior"""
        try:
            session_file = self.get_session_file(account['username'])
            
            # First, try going to Instagram to check if already logged in
            logger.info("Navigating to Instagram homepage...")
            await self.page.goto('https://www.instagram.com/', wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(4, 6)
            
            # Check current URL
            current_url = self.page.url
            logger.info(f"Current URL: {current_url}")
            
            # If not on login page, verify with a page that exige login (explore e depois hashtag)
            if '/accounts/login' not in current_url:
                # 1) Explore: às vezes redireciona com atraso, então esperar um pouco após carregar
                await self.page.goto('https://www.instagram.com/explore/', wait_until='domcontentloaded', timeout=30000)
                await self.human_delay(5, 8)
                if '/accounts/login' in self.page.url:
                    logger.info("Session invalid after /explore/, need to login")
                else:
                    # 2) Verificar com hashtag "genérica" (não usar "instagram" que pode ser tratada como pública)
                    await self.page.goto('https://www.instagram.com/explore/tags/foto/', wait_until='domcontentloaded', timeout=30000)
                    await self.human_delay(4, 6)
                    if '/accounts/login' in self.page.url:
                        logger.info("Session invalid for hashtag pages (redirect to login), need to login")
                    else:
                        logger.info("Already logged in! Session verified (explore + hashtag).")
                        self._last_logged_account = account
                        cookies = await self.context.cookies()
                        with open(session_file, 'w') as f:
                            json.dump(cookies, f)
                        return True
            
            # Need to perform login (form)
            ok = await self._do_form_login_instagram(account)
            if ok:
                self._last_logged_account = account
                session_file = self.get_session_file(account['username'])
                cookies = await self.context.cookies()
                with open(session_file, 'w') as f:
                    json.dump(cookies, f)
                logger.info(f"Session saved for {account['username']}")
            return ok

        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return False

    async def _do_form_login_instagram(self, account: Dict) -> bool:
        """Login via form. Handles both old and new Instagram login page layouts."""
        try:
            logger.info("Going to login page (form login)...")
            await self.page.goto('https://www.instagram.com/accounts/login/', wait_until='load', timeout=45000)
            await self.human_delay(5, 8)

            username_filled = False
            password_filled = False

            # 1) Try CSS selectors (most reliable — handles both old and new form)
            username_selectors = [
                'input[name="username"]', 'input[name="email"]',
                'input[autocomplete*="username"]', 'input[aria-label*="username" i]',
                'input[aria-label*="email" i]', 'input[aria-label*="Telefone" i]',
                'input[aria-label*="Phone" i]', 'form input[type="text"]',
            ]
            password_selectors = [
                'input[name="password"]', 'input[name="pass"]', 'input[type="password"]',
            ]

            for sel in username_selectors:
                try:
                    elem = await self.page.wait_for_selector(sel, timeout=3000, state='visible')
                    if elem:
                        await elem.click()
                        await self.human_delay(0.3, 0.6)
                        await elem.fill(account['username'])
                        logger.info(f"Filled username via: {sel}")
                        username_filled = True
                        break
                except Exception:
                    continue

            if not username_filled:
                # Label fallback
                for label in ["Phone number, username, or email", "Telefone, nome de usuário ou e-mail", "Username"]:
                    try:
                        loc = self.page.get_by_label(label, exact=False)
                        if await loc.count() > 0:
                            await loc.first.fill(account['username'])
                            logger.info(f"Filled username via label: {label}")
                            username_filled = True
                            break
                    except Exception:
                        continue

            if not username_filled:
                logger.error("Could not find username input")
                await self.page.screenshot(path='/tmp/login_debug.png')
                return False

            await self.human_delay(1, 2)

            for sel in password_selectors:
                try:
                    elem = await self.page.query_selector(sel)
                    if elem:
                        await elem.click()
                        await self.human_delay(0.3, 0.6)
                        await elem.fill(account['password'])
                        logger.info(f"Filled password via: {sel}")
                        password_filled = True
                        break
                except Exception:
                    continue

            if not password_filled:
                for label in ["Password", "Senha"]:
                    try:
                        loc = self.page.get_by_label(label, exact=False)
                        if await loc.count() > 0:
                            await loc.first.fill(account['password'])
                            password_filled = True
                            break
                    except Exception:
                        continue

            if not password_filled:
                logger.error("Could not find password input")
                return False

            await self.move_mouse_randomly(self.page)
            await self.human_delay(0.5, 1.0)

            # Submit: try multiple strategies
            submit_clicked = False
            # input[type=submit] (new layout)
            for sel in ['input[type="submit"]', 'button[type="submit"]']:
                try:
                    btn = await self.page.query_selector(sel)
                    if btn:
                        await btn.click()
                        logger.info(f"Clicked submit via: {sel}")
                        submit_clicked = True
                        break
                except Exception:
                    continue

            if not submit_clicked:
                for name in ["Log in", "Entrar", "Login"]:
                    try:
                        btn = self.page.get_by_role("button", name=name)
                        if await btn.count() > 0:
                            await btn.first.click()
                            logger.info(f"Clicked login button (role): {name}")
                            submit_clicked = True
                            break
                    except Exception:
                        continue

            if not submit_clicked:
                for sel in ['button:has-text("Log in")', 'button:has-text("Entrar")', 'div[role="button"]:has-text("Log in")']:
                    try:
                        btn = await self.page.query_selector(sel)
                        if btn:
                            await btn.click()
                            submit_clicked = True
                            break
                    except Exception:
                        continue

            logger.info("Waiting for login to complete...")
            await self.human_delay(8, 12)

            current_url = self.page.url
            logger.info(f"Current URL after login: {current_url}")

            if 'challenge' in current_url or 'codeentry' in current_url or 'auth_platform' in current_url:
                logger.warning(f"Instagram is requesting verification! URL: {current_url[:100]}")
                # Even with verification pending, the session cookies may grant partial access
                # (e.g., hashtag browsing) — return True to continue with what we can do
                return True

            if '/accounts/login' not in current_url:
                logger.info("Form login successful!")
                return True
            logger.warning("Form login may have failed")
            return False
        except Exception as e:
            logger.error(f"Form login error: {str(e)}")
            return False

    async def _try_api_profile(self, username: str) -> Optional[Dict]:
        """Try Instagram's internal web API to fetch profile data (works with partial session)."""
        try:
            api_url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
            resp_text = await self.page.evaluate("""
                async (url) => {
                    try {
                        const r = await fetch(url, {
                            credentials: 'include',
                            headers: {'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest'}
                        });
                        if (!r.ok) return null;
                        return await r.text();
                    } catch(e) { return null; }
                }
            """, api_url)
            if not resp_text:
                return None
            data = json.loads(resp_text)
            user = data.get('data', {}).get('user', {})
            if not user:
                return None
            bio = user.get('biography', '')
            contact = self.extract_contact_info(bio) if bio else {'email': None, 'phone': None, 'website': None}
            location = None
            address = None
            if user.get('business_address_json'):
                try:
                    addr_data = json.loads(user['business_address_json'])
                    if addr_data.get('city_name'):
                        location = addr_data['city_name']
                        if addr_data.get('region_name'):
                            location += f", {addr_data['region_name']}"
                    if addr_data.get('street_address'):
                        address = addr_data['street_address']
                except Exception:
                    pass
            if not location and user.get('city_name'):
                location = user['city_name']
            if not location and bio:
                location = self._extract_location_from_bio(bio)
            pic_url = user.get('profile_pic_url_hd') or user.get('profile_pic_url')
            ext_url = user.get('external_url')
            website = None
            if ext_url and 'instagram.com' not in ext_url.lower() and 'facebook.com' not in ext_url.lower():
                website = ext_url
            if not website:
                website = contact.get('website')
            result = {
                'username': username,
                'name': user.get('full_name') or username,
                'bio': bio or None,
                'email': user.get('business_email') or contact.get('email'),
                'phone': user.get('business_phone_number') or contact.get('phone'),
                'website': website,
                'profile_image_url': pic_url,
                'location': location,
                'address': address,
                'profile_url': f'https://instagram.com/{username}',
                'followers': user.get('edge_followed_by', {}).get('count'),
                'following': user.get('edge_follow', {}).get('count'),
                'posts': user.get('edge_owner_to_timeline_media', {}).get('count'),
            }
            logger.info(f"API profile @{username}: name={result['name']}, followers={result['followers']}, bio={bool(bio)}")
            return result
        except Exception as e:
            logger.debug(f"API profile fetch failed for @{username}: {e}")
            return None

    async def scrape_profile(self, username: str, _retry: int = 0) -> Optional[Dict]:
        """Scrape a single Instagram profile with human-like behavior"""
        MAX_RETRIES = 2
        try:
            logger.info(f"Scraping profile: @{username}")

            # === TRY API FIRST (fastest and most reliable) ===
            api_result = await self._try_api_profile(username)
            if api_result and (api_result.get('followers') is not None or api_result.get('bio')):
                await self.human_delay(1, 2)
                return api_result

            await self.page.goto(f'https://www.instagram.com/{username}/', wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(3, 5)

            if '/accounts/login' in self.page.url:
                logger.warning(f"Login required to view @{username}")
                return api_result or {
                    'username': username, 'name': None, 'bio': None, 'email': None,
                    'phone': None, 'website': None, 'profile_image_url': None,
                    'location': None, 'profile_url': f'https://instagram.com/{username}',
                    'followers': None, 'following': None, 'posts': None,
                }

            await self.move_mouse_randomly(self.page)

            page_title = await self.page.title()
            if 'Page Not Found' in page_title or 'Página não encontrada' in page_title:
                logger.info(f"Profile @{username} not found")
                return None

            await self.page.wait_for_load_state('domcontentloaded', timeout=20000)
            await self.human_delay(2, 3)

            result = {
                'username': username, 'name': None, 'bio': None, 'email': None,
                'phone': None, 'website': None, 'profile_image_url': None,
                'location': None, 'address': None,
                'profile_url': f'https://instagram.com/{username}',
                'followers': None, 'following': None, 'posts': None,
            }

            def _parse_count(s: str) -> Optional[int]:
                if not s:
                    return None
                s = s.replace(',', '').replace('.', '').replace(' ', '').strip()
                if 'K' in s.upper():
                    try: return int(float(s.upper().replace('K', '').replace('M', '')) * 1000)
                    except ValueError: return None
                if 'M' in s.upper():
                    try: return int(float(s.upper().replace('M', '')) * 1000000)
                    except ValueError: return None
                if 'mil' in s.lower():
                    s = s.lower().replace('mil', '')
                nums = re.findall(r'\d+', s)
                return int(nums[0]) if nums else None

            # === 1) EXTRACT FROM EMBEDDED JSON (most reliable) ===
            try:
                embed = await self.page.evaluate(
                    r"""() => {
                        const result = {followers:null, following:null, posts:null,
                                        biography:null, profile_pic_url:null,
                                        full_name:null, external_url:null,
                                        business_email:null, business_phone:null,
                                        business_address:null, city_name:null,
                                        is_business:false, category_name:null};
                        const scripts = document.querySelectorAll("script");
                        for (const s of scripts) {
                            const t = s.textContent || "";
                            if (!t.includes("edge_followed_by") && !t.includes("biography")) continue;
                            // Stats
                            const fr = t.match(/"edge_followed_by":\s*\{\s*"count":\s*(\d+)/);
                            const fg = t.match(/"edge_follow":\s*\{\s*"count":\s*(\d+)/);
                            const po = t.match(/"edge_owner_to_timeline_media":\s*\{\s*"count":\s*(\d+)/);
                            if (fr) result.followers = parseInt(fr[1], 10);
                            if (fg) result.following = parseInt(fg[1], 10);
                            if (po) result.posts = parseInt(po[1], 10);
                            // Biography
                            const biMatch = t.match(/"biography":\s*"((?:[^"\\]|\\.)*)"/);
                            if (biMatch) result.biography = biMatch[1].replace(/\\n/g,"\n").replace(/\\"/g,'"').replace(/\\\\/g,"\\");
                            // Profile pic (prefer HD)
                            const picHd = t.match(/"profile_pic_url_hd":\s*"([^"]+)"/);
                            const pic = picHd || t.match(/"profile_pic_url":\s*"([^"]+)"/);
                            if (pic) result.profile_pic_url = pic[1].replace(/\\u0026/g,"&");
                            // Full name
                            const fn = t.match(/"full_name":\s*"((?:[^"\\]|\\.)*)"/);
                            if (fn) result.full_name = fn[1];
                            // External URL
                            const eu = t.match(/"external_url":\s*"([^"]+)"/);
                            if (eu) result.external_url = eu[1].replace(/\\u0026/g,"&");
                            // Business fields
                            const be = t.match(/"business_email":\s*"([^"]+)"/);
                            if (be) result.business_email = be[1];
                            const bp = t.match(/"business_phone_number":\s*"([^"]+)"/);
                            if (bp) result.business_phone = bp[1];
                            const ba = t.match(/"business_address_json":\s*"((?:[^"\\]|\\.)*)"/);
                            if (ba) result.business_address = ba[1];
                            const cn = t.match(/"city_name":\s*"((?:[^"\\]|\\.)*)"/);
                            if (cn) result.city_name = cn[1];
                            const ib = t.match(/"is_business_account":\s*(true|false)/);
                            if (ib) result.is_business = ib[1] === "true";
                            const cat = t.match(/"category_name":\s*"((?:[^"\\]|\\.)*)"/);
                            if (cat) result.category_name = cat[1];
                            if (result.followers !== null) return result;
                        }
                        return result.biography || result.profile_pic_url ? result : null;
                    }"""
                )
                if embed:
                    if embed.get('followers') is not None:
                        result['followers'] = embed['followers']
                    if embed.get('following') is not None:
                        result['following'] = embed['following']
                    if embed.get('posts') is not None:
                        result['posts'] = embed['posts']
                    if embed.get('full_name'):
                        result['name'] = embed['full_name']
                    if embed.get('biography'):
                        result['bio'] = embed['biography']
                    if embed.get('profile_pic_url'):
                        result['profile_image_url'] = embed['profile_pic_url']
                    if embed.get('external_url'):
                        ext = embed['external_url']
                        if not any(x in ext.lower() for x in ['instagram.com', 'facebook.com']):
                            result['website'] = ext
                    if embed.get('business_email'):
                        result['email'] = embed['business_email']
                    if embed.get('business_phone'):
                        result['phone'] = embed['business_phone']
                    if embed.get('city_name'):
                        result['location'] = embed['city_name']
                    if embed.get('business_address'):
                        try:
                            addr_data = json.loads(embed['business_address'].replace('\\"', '"').replace('\\\\', '\\'))
                            parts = []
                            if addr_data.get('street_address'):
                                result['address'] = addr_data['street_address']
                                parts.append(addr_data['street_address'])
                            if addr_data.get('city_name'):
                                result['location'] = addr_data['city_name']
                                parts.append(addr_data['city_name'])
                            if addr_data.get('region_name'):
                                parts.append(addr_data['region_name'])
                                if result['location']:
                                    result['location'] += f", {addr_data['region_name']}"
                                else:
                                    result['location'] = addr_data['region_name']
                        except Exception:
                            pass
                    # Extract contact from bio if not already found
                    if result['bio']:
                        contact = self.extract_contact_info(result['bio'])
                        result['email'] = result['email'] or contact.get('email')
                        result['phone'] = result['phone'] or contact.get('phone')
                        result['website'] = result['website'] or contact.get('website')
                        if not result.get('location'):
                            result['location'] = self._extract_location_from_bio(result['bio'])
            except Exception as e:
                logger.debug(f"Embed JSON extraction: {e}")

            # === 2) EXTRACT FROM META TAGS (og:description often has bio) ===
            if not result.get('bio') or not result.get('profile_image_url'):
                try:
                    meta_data = await self.page.evaluate("""() => {
                        const res = {};
                        const ogDesc = document.querySelector('meta[property="og:description"]');
                        if (ogDesc) res.og_description = ogDesc.getAttribute('content');
                        const ogImg = document.querySelector('meta[property="og:image"]');
                        if (ogImg) res.og_image = ogImg.getAttribute('content');
                        const ogTitle = document.querySelector('meta[property="og:title"]');
                        if (ogTitle) res.og_title = ogTitle.getAttribute('content');
                        return res;
                    }""")
                    if meta_data:
                        if not result.get('profile_image_url') and meta_data.get('og_image'):
                            result['profile_image_url'] = meta_data['og_image']
                        if not result.get('bio') and meta_data.get('og_description'):
                            desc = meta_data['og_description']
                            bio_match = re.search(r':\s*"(.+)"', desc)
                            if bio_match:
                                result['bio'] = bio_match.group(1)
                        if not result.get('name') and meta_data.get('og_title'):
                            title = meta_data['og_title']
                            name_match = re.match(r'^(.+?)\s*[(\[@]', title)
                            if name_match:
                                result['name'] = name_match.group(1).strip()
                except Exception:
                    pass

            # === 3) FALLBACK: body text for stats ===
            body_text = ""
            try:
                body_text = await self.page.inner_text('body')
            except Exception:
                pass

            if body_text:
                try:
                    if result['posts'] is None:
                        posts_match = re.search(r'([\d,.]+[KMkm]?)\s*(?:posts|publicações|publicações?|post)', body_text, re.IGNORECASE)
                        if posts_match:
                            result['posts'] = _parse_count(posts_match.group(1))
                    if result['followers'] is None:
                        for pattern in [
                            r'([\d,.]+[KMkm]?)\s*(?:followers|seguidores)(?!\s*\d)',
                            r'(?:^|\s)([\d,.]+[KMkm]?)\s+(?:followers|seguidores)',
                        ]:
                            match = re.search(pattern, body_text, re.IGNORECASE)
                            if match:
                                result['followers'] = _parse_count(match.group(1))
                                break
                    if result['following'] is None:
                        following_match = re.search(r'([\d,.]+[KMkm]?)\s*(?:following|seguindo)', body_text, re.IGNORECASE)
                        if following_match:
                            result['following'] = _parse_count(following_match.group(1))
                except Exception:
                    pass

            # === 4) FALLBACK: name from DOM ===
            if not result.get('name'):
                try:
                    for selector in ['header section span', 'header h2', 'span[style*="font-weight"]']:
                        name_elem = await self.page.query_selector(selector)
                        if name_elem:
                            name_text = await name_elem.inner_text()
                            if name_text and 2 < len(name_text) < 100:
                                result['name'] = name_text.strip()
                                break
                except Exception:
                    pass

            # === 5) FALLBACK: expand "more" and extract bio from DOM ===
            if not result.get('bio'):
                try:
                    more_loc = self.page.get_by_text("mais", exact=False).first
                    if await more_loc.count() > 0:
                        await more_loc.click(timeout=3000)
                        await self.human_delay(1, 2)
                    else:
                        more_loc = self.page.get_by_text("more", exact=False).first
                        if await more_loc.count() > 0:
                            await more_loc.click(timeout=2000)
                            await self.human_delay(1, 2)
                except Exception:
                    pass

            if not result.get('bio'):
                try:
                    stats_line = re.compile(
                        r'^[\d.,\sKkMm]+(?:posts?|seguidores?|following|seguindo|publicações?)$',
                        re.IGNORECASE,
                    )
                    seen = set()
                    bio_parts = []
                    for selector in [
                        'header section div > span', 'div.-vDIg span', 'header section span',
                        'header section div', 'header span',
                    ]:
                        elems = await self.page.query_selector_all(selector)
                        for elem in elems:
                            try:
                                t = (await elem.inner_text()).strip()
                                if not t or len(t) <= 2 or t in ('mais', 'more', '...'):
                                    continue
                                if stats_line.match(t):
                                    continue
                                if t in seen or any(t in s or s in t for s in seen if len(t) > 5 and len(s) > 5):
                                    continue
                                if len(t) > 500:
                                    bio_parts = [t]
                                    break
                                seen.add(t)
                                bio_parts.append(t)
                            except Exception:
                                continue
                        if bio_parts and len(bio_parts[0]) > 500:
                            break
                    if bio_parts:
                        full_bio = '\n'.join(bio_parts) if len(bio_parts) > 1 else bio_parts[0]
                        full_bio = re.sub(
                            r'[\s\n]*[\d.,KkMm]+\s*(?:posts?|seguidores?|following|seguindo|publicações?)[\s\n]*',
                            ' ', full_bio, flags=re.IGNORECASE,
                        ).strip()
                        full_bio = re.sub(r'\n\s*\n', '\n', full_bio).strip()
                        if len(full_bio) > 10:
                            result['bio'] = full_bio
                            contact = self.extract_contact_info(full_bio)
                            result['email'] = result['email'] or contact.get('email')
                            result['phone'] = result['phone'] or contact.get('phone')
                            result['website'] = result['website'] or contact.get('website')
                            if not result.get('location'):
                                result['location'] = self._extract_location_from_bio(full_bio)
                except Exception:
                    pass

            # === 6) FALLBACK: profile image from DOM ===
            if not result.get('profile_image_url'):
                try:
                    for img_sel in [
                        'header img[src*="cdninstagram"]', 'header img[src*="fbcdn"]',
                        'header img[src*="scontent"]', 'img[alt*="profile" i]',
                        'header img',
                    ]:
                        img = await self.page.query_selector(img_sel)
                        if img:
                            src = await img.get_attribute('src')
                            if src and src.startswith('http'):
                                result['profile_image_url'] = src
                                break
                except Exception:
                    pass

            # === 7) FALLBACK: website from DOM link ===
            if not result.get('website'):
                try:
                    for link_sel in [
                        'header section a[href^="http"]',
                        'a[href*="l.instagram.com"]',
                        'header a[href^="http"]',
                    ]:
                        link_elem = await self.page.query_selector(link_sel)
                        if link_elem:
                            href = await link_elem.get_attribute('href')
                            if href:
                                # Resolve Instagram redirect links
                                if 'l.instagram.com' in href:
                                    u_match = re.search(r'[?&]u=([^&]+)', href)
                                    if u_match:
                                        from urllib.parse import unquote
                                        href = unquote(u_match.group(1))
                                skip_domains = ['instagram.com', 'facebook.com', 'l.instagram.com']
                                if not any(x in href.lower() for x in skip_domains):
                                    result['website'] = href.strip()
                                    break
                except Exception:
                    pass

            # === 8) FALLBACK: stats from header links ===
            try:
                stat_links = await self.page.query_selector_all('header a[href]')
                for link in stat_links:
                    href = await link.get_attribute('href') or ''
                    span = await link.query_selector('span')
                    if not span:
                        continue
                    text = await span.inner_text()
                    val = _parse_count(text)
                    if val is None:
                        continue
                    if '/followers' in href and result['followers'] is None:
                        result['followers'] = val
                    elif '/following' in href and result['following'] is None:
                        result['following'] = val
                if result['posts'] is None:
                    for sel in ['a[href*="/"][role="link"] span', 'header ul li span', 'section ul li span']:
                        elems = await self.page.query_selector_all(sel)
                        for elem in elems:
                            t = await elem.inner_text()
                            if re.match(r'^[\d,.KkMm]+$', t.strip()):
                                v = _parse_count(t)
                                if v is not None:
                                    result['posts'] = v
                                    break
                        if result['posts'] is not None:
                            break
            except Exception:
                pass

            await self.human_scroll(self.page, times=1)
            await self.human_delay(1, 2)

            logger.info(
                f"Scraped @{username}: name={result.get('name')}, bio={bool(result.get('bio'))}, "
                f"email={result.get('email')}, phone={result.get('phone')}, website={result.get('website')}, "
                f"img={bool(result.get('profile_image_url'))}, location={result.get('location')}, "
                f"followers={result.get('followers')}"
            )
            return result

        except Exception as e:
            logger.error(f"Error scraping profile @{username}: {str(e)}")
            if _retry < MAX_RETRIES:
                logger.info(f"Retrying @{username} ({_retry+1}/{MAX_RETRIES})...")
                await self.human_delay(3, 6)
                return await self.scrape_profile(username, _retry=_retry + 1)
            return None
    
    async def scrape_hashtag(
        self,
        hashtag: str,
        max_profiles: int = 20,
        exclude_usernames: Optional[Set[str]] = None,
        scroll_times: int = 5,
    ) -> List[Dict]:
        """Scrape profiles from a hashtag with human-like behavior.
        exclude_usernames: não retorna perfis já conhecidos (evita re-scrape).
        scroll_times: quantas vezes rolar a página para carregar mais resultados.
        """
        results = []
        exclude = exclude_usernames or set()

        try:
            hashtag_clean = hashtag.replace('#', '').strip()
            url = f"https://www.instagram.com/explore/tags/{hashtag_clean}/"
            
            logger.info(f"Navigating to hashtag: #{hashtag_clean} (scroll_times={scroll_times}, exclude={len(exclude)} usernames)")
            await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await self.human_delay(4, 6)
            
            # Wait for content (avoid networkidle to save proxy data)
            try:
                await self.page.wait_for_selector('a[href^="/"]', timeout=20000)
            except Exception:
                pass
            
            current_url = self.page.url
            logger.info(f"Current URL: {current_url}")
            
            # Se redirecionou para login: forçar login por formulário (sem usar sessão) e tentar de novo
            if '/accounts/login' in current_url:
                account = self._last_logged_account or self.get_next_account()
                if account:
                    logger.warning("Hashtag redirected to login; forcing form login and retrying once...")
                    re_logged = await self._do_form_login_instagram(account)
                    if re_logged:
                        self._last_logged_account = account
                        try:
                            session_file = self.get_session_file(account['username'])
                            cookies = await self.context.cookies()
                            with open(session_file, 'w') as f:
                                json.dump(cookies, f)
                        except Exception as e:
                            logger.debug(f"Could not save session after re-login: {e}")
                        await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
                        await self.human_delay(4, 6)
                        try:
                            await self.page.wait_for_selector('a[href^="/"]', timeout=20000)
                        except Exception:
                            pass
                        current_url = self.page.url
                        if '/accounts/login' in current_url:
                            logger.warning("Still on login page after form login; cannot view hashtag")
                            return results
                        logger.info("Form login OK, continuing with hashtag")
                    else:
                        logger.warning("Form login failed; cannot view hashtag")
                        return results
                else:
                    logger.warning("Need to login to view hashtag (no scraping account configured)")
                    return results
            
            # Scroll to load more content
            logger.info(f"Scrolling to load content... ({scroll_times} times)")
            await self.human_scroll(self.page, times=scroll_times)
            
            scraped_in_run: Set[str] = set()
            max_links_to_visit = 80
            scroll_retries = 5

            for retry in range(scroll_retries):
                if len(results) >= max_profiles:
                    break
                # Buscar só links de posts/reels do grid da hashtag (ignora header com perfil da conta)
                reel_links = await self.page.query_selector_all('a[href*="/reel/"]')
                post_links = await self.page.query_selector_all('a[href*="/p/"]')
                seen_hrefs: Set[str] = set()
                post_reel_hrefs: List[str] = []
                for el in reel_links + post_links:
                    try:
                        h = await el.get_attribute('href')
                        if h and h not in seen_hrefs:
                            seen_hrefs.add(h)
                            post_reel_hrefs.append(h)
                    except Exception:
                        continue
                need = max_profiles - len(results)
                logger.info(
                    f"Hashtag #{hashtag_clean}: found {len(post_reel_hrefs)} post/reel links "
                    f"(round {retry+1}/{scroll_retries}), need {need} more new leads (exclude={len(exclude)})"
                )

                links_visited = 0
                for href in post_reel_hrefs:
                    if len(results) >= max_profiles or links_visited >= max_links_to_visit:
                        break
                    try:
                        full_url = f"https://www.instagram.com{href}" if href.startswith('/') else href
                        await self.page.goto(full_url, wait_until='domcontentloaded', timeout=20000)
                        await self.human_delay(2, 4)
                        username = await self._extract_username_from_page(exclude_usernames=exclude)
                        if not username or not self._is_valid_username(username):
                            links_visited += 1
                            await self.page.goto(url, wait_until='domcontentloaded', timeout=20000)
                            await self.human_delay(2, 3)
                            continue
                        if username in exclude or username in scraped_in_run:
                            scraped_in_run.add(username)
                            links_visited += 1
                            await self.page.goto(url, wait_until='domcontentloaded', timeout=20000)
                            await self.human_delay(2, 3)
                            continue
                        scraped_in_run.add(username)
                        profile_data = await self.scrape_profile(username)
                        if profile_data:
                            profile_data['source'] = 'hashtag'
                            results.append(profile_data)
                            logger.info(f"New lead from hashtag: @{username} ({len(results)}/{max_profiles})")
                            if len(results) >= max_profiles:
                                break
                        await self.human_delay(3, 6)
                        await self.page.goto(url, wait_until='domcontentloaded', timeout=20000)
                        await self.human_delay(2, 3)
                        links_visited += 1
                    except Exception as e:
                        logger.debug(f"Error visiting post/reel: {e}")
                        continue

                if len(results) >= max_profiles:
                    break
                if retry < scroll_retries - 1:
                    logger.info("Scrolling to load more posts from hashtag...")
                    await self.human_scroll(self.page, times=5)
                    await self.human_delay(3, 5)
            
            logger.info(f"Hashtag #{hashtag_clean}: found {len(results)} leads (exclude={len(exclude)}, max {max_profiles})")
        
        except Exception as e:
            logger.error(f"Error scraping hashtag #{hashtag}: {str(e)}")
        
        return results
    
    async def scrape_search(
        self,
        keyword: str,
        max_profiles: int = 20,
        exclude_usernames: Optional[Set[str]] = None,
    ) -> List[Dict]:
        """Scrape profiles from Instagram search by keyword (people search).
        exclude_usernames: não retorna perfis já conhecidos.
        """
        results = []
        exclude = exclude_usernames or set()
        try:
            # Instagram web: topsearch returns users, hashtags, places (same cookies as page)
            query = keyword.strip()
            if not query:
                return results
            logger.info(f"Searching Instagram for: {query}")
            url = f"https://www.instagram.com/web/search/topsearch/?query={query}"
            try:
                resp = await self.page.evaluate("""
                    async (url) => {
                        const r = await fetch(url, { credentials: 'include' });
                        const j = await r.json();
                        return JSON.stringify(j);
                    }
                """, url)
                data = json.loads(resp)
                # Debug: log what topsearch returned (helps when result is 0)
                users_raw = data.get("users")
                if users_raw is not None:
                    count = len(users_raw) if isinstance(users_raw, list) else (len(users_raw) if isinstance(users_raw, dict) else 0)
                    logger.info(f"Instagram topsearch API returned: users count={count}, keys={list(data.keys())}")
                else:
                    logger.warning(f"Instagram topsearch API response has no 'users'; keys={list(data.keys())}")
            except Exception as e:
                logger.warning(f"Instagram topsearch fetch failed: {e}, trying explore")
                # Fallback: go to explore and look for profile links (less reliable)
                await self.page.goto(f"https://www.instagram.com/explore/", wait_until='domcontentloaded', timeout=30000)
                await self.human_delay(3, 5)
                all_links = await self.page.query_selector_all('a[href^="/"]')
                usernames_found = set()
                for link in all_links:
                    if len(usernames_found) >= max_profiles:
                        break
                    href = await link.get_attribute('href')
                    if href:
                        parts = href.strip('/').split('/')
                        if len(parts) == 1 and self._is_valid_username(parts[0]):
                            usernames_found.add(parts[0])
                for username in list(usernames_found)[:max_profiles]:
                    profile_data = await self.scrape_profile(username)
                    if profile_data:
                        profile_data['source'] = 'search'
                        results.append(profile_data)
                    await self.human_delay(2, 4)
                return results
            
            users = (data.get("users") or [])
            if isinstance(users, dict):
                users = list(users.values()) if users else []
            # Pegar só usuários novos (não em exclude), até max_profiles
            count = 0
            for item in users:
                if count >= max_profiles:
                    break
                try:
                    if not isinstance(item, dict):
                        continue
                    user_obj = item.get("user") or item
                    username = (user_obj.get("username") if isinstance(user_obj, dict) else None) or item.get("username")
                    if not username or not self._is_valid_username(username) or username in exclude:
                        continue
                    profile_data = await self.scrape_profile(username)
                    if profile_data:
                        profile_data['source'] = 'search'
                        results.append(profile_data)
                        count += 1
                    await self.human_delay(2, 4)
                except Exception as e:
                    logger.debug(f"Error scraping search result: {e}")
                    continue
            logger.info(f"Instagram search '{keyword}': found {len(results)} leads (exclude={len(exclude)} usernames)")
        except Exception as e:
            logger.error(f"Error searching Instagram for {keyword}: {str(e)}")
        return results
    
    def _is_valid_username(self, username: str) -> bool:
        """Check if a string is a valid Instagram username"""
        if not username:
            return False
        
        # Segmentos de URL do Instagram que não são usernames
        invalid = [
            'p', 'reel', 'reels', 'explore', 'stories', 'accounts',
            'about', 'direct', 'popular', 'legal', 'privacy',
            'accounts/emailsignup', 'legal/privacy', 'tags',
            'web',  # /web/search, etc.
            'api', 'developer', 'blog', 'help', 'contact', 'support',
            'embed', 'tv', 'graphql', 'static', 'mail', 'i',
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
    
    async def _extract_username_from_page(
        self, exclude_usernames: Optional[Set[str]] = None
    ) -> Optional[str]:
        """Extract username of the post/reel author from current page.
        exclude_usernames: ignorar (ex.: conta de login que aparece no header).
        """
        exclude = exclude_usernames or set()
        try:
            # Ordem: priorizar área do post/reel (autor), depois header genérico
            # No post/reel o autor costuma estar em article, main ou na primeira section do conteúdo
            area_selectors = [
                'article header a[href^="/"]',
                'main header a[href^="/"]',
                'article a[href^="/"]',
                'main a[href^="/"]',
                'section a[href^="/"]',
                'header a[href^="/"]',
                'a[role="link"][href^="/"]',
            ]
            for selector in area_selectors:
                elements = await self.page.query_selector_all(selector)
                for elem in elements:
                    href = await elem.get_attribute('href')
                    if not href or not href.startswith('/'):
                        continue
                    parts = href.strip('/').split('/')
                    username = parts[0] if parts else None
                    if (
                        username
                        and self._is_valid_username(username)
                        and username not in exclude
                    ):
                        return username
        except Exception as e:
            logger.debug(f"Error extracting username: {e}")
        return None
    
    async def close(self):
        """Close browser"""
        if self.browser:
            await self.browser.close()

# ===================== DATA NORMALIZATION =====================

def normalize_lead(lead: Dict, platform: str) -> Dict:
    """Normalize lead data to a standardized structure across all platforms."""
    normalized = {
        'username': lead.get('username', ''),
        'name': lead.get('name'),
        'bio': lead.get('bio'),
        'email': lead.get('email'),
        'phone': lead.get('phone'),
        'website': lead.get('website'),
        'profile_image_url': lead.get('profile_image_url'),
        'location': lead.get('location'),
        'address': lead.get('address'),
        'profile_url': lead.get('profile_url', ''),
        'followers': lead.get('followers'),
        'following': lead.get('following'),
        'posts': lead.get('posts'),
        'likes': lead.get('likes'),
        'videos': lead.get('videos'),
        'source': lead.get('source', 'search'),
        'platform': platform,
    }
    # Clean up: strip whitespace from string fields
    for key in ['name', 'bio', 'email', 'phone', 'website', 'location', 'address']:
        if isinstance(normalized.get(key), str):
            normalized[key] = normalized[key].strip() or None
    # Ensure profile_url is set
    if not normalized.get('profile_url') and normalized.get('username'):
        url_map = {
            'instagram': f"https://instagram.com/{normalized['username']}",
            'tiktok': f"https://tiktok.com/@{normalized['username']}",
            'linkedin': f"https://linkedin.com/in/{normalized['username']}",
            'facebook': f"https://facebook.com/{normalized['username']}",
        }
        normalized['profile_url'] = url_map.get(platform, '')
    return normalized


# ===================== API ENDPOINTS =====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "scraper", "version": "3.0.0"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_profiles(request: ScrapeRequest):
    """Main scraping endpoint - supports Instagram and TikTok"""
    platform = request.platform.lower()
    logger.info(f"Received scrape request for {platform}: {len(request.keywords)} keywords, {len(request.hashtags)} hashtags")
    
    proxies = [proxy.model_dump() for proxy in request.proxies]
    all_leads = []
    errors = []
    
    if platform == "linkedin":
        scraper = LinkedInScraper(proxies)
        client_exclude = set(request.exclude_usernames or [])
        try:
            proxy = scraper.get_proxy()
            await scraper.setup_browser(proxy=proxy)
            for keyword in request.keywords:
                try:
                    leads = await scraper.scrape_search(keyword, max_profiles=request.max_profiles, exclude_usernames=client_exclude)
                    all_leads.extend(leads)
                except Exception as e:
                    errors.append(f"Error searching LinkedIn for {keyword}: {str(e)}")
            for hashtag in request.hashtags:
                try:
                    leads = await scraper.scrape_search(hashtag.replace('#', ''), max_profiles=request.max_profiles, exclude_usernames=client_exclude)
                    all_leads.extend(leads)
                except Exception as e:
                    errors.append(f"Error searching LinkedIn for {hashtag}: {str(e)}")
        finally:
            await scraper.close()

    elif platform == "facebook":
        scraper = FacebookScraper(proxies)
        client_exclude = set(request.exclude_usernames or [])
        try:
            proxy = scraper.get_proxy()
            await scraper.setup_browser(proxy=proxy)
            for keyword in request.keywords:
                try:
                    leads = await scraper.scrape_search(keyword, max_profiles=request.max_profiles, exclude_usernames=client_exclude)
                    all_leads.extend(leads)
                except Exception as e:
                    errors.append(f"Error searching Facebook for {keyword}: {str(e)}")
            for hashtag in request.hashtags:
                try:
                    leads = await scraper.scrape_search(hashtag.replace('#', ''), max_profiles=request.max_profiles, exclude_usernames=client_exclude)
                    all_leads.extend(leads)
                except Exception as e:
                    errors.append(f"Error searching Facebook for {hashtag}: {str(e)}")
        finally:
            await scraper.close()

    elif platform == "tiktok":
        scraper = TikTokScraper(proxies)
        tiktok_has_location = bool(request.location and request.location.strip())
        LOCATION_SEARCH_TIMEOUT_SEC = 3600
        BATCH_PER_SOURCE = 15
        client_exclude = set(request.exclude_usernames or [])
        if client_exclude:
            logger.info(f"TikTok: excluding {len(client_exclude)} existing client lead(s)")

        try:
            proxy = scraper.get_proxy()
            if proxy:
                logger.info(f"Using proxy: {proxy['host']}:{proxy['port']}")
            await scraper.setup_browser(proxy=proxy)

            if tiktok_has_location:
                deadline = time.monotonic() + LOCATION_SEARCH_TIMEOUT_SEC
                seen_usernames: Set[str] = set(client_exclude)
                round_num = 0
                logger.info(
                    f"Location filter active (TikTok): will search up to 1h until {request.max_profiles} leads match '{request.location}'"
                )
                while time.monotonic() < deadline:
                    matching = [l for l in all_leads if _lead_matches_location(l, request.location)]
                    if len(matching) >= request.max_profiles:
                        break
                    round_num += 1
                    for hashtag in request.hashtags:
                        if time.monotonic() >= deadline:
                            break
                        try:
                            leads = await scraper.scrape_hashtag(
                                hashtag,
                                max_profiles=BATCH_PER_SOURCE,
                                exclude_usernames=seen_usernames,
                            )
                            for lead in leads:
                                seen_usernames.add(lead["username"])
                                all_leads.append(lead)
                            if leads:
                                logger.info(f"TikTok hashtag #{hashtag} (round {round_num}): +{len(leads)} leads")
                        except Exception as e:
                            error_msg = f"Error scraping TikTok hashtag {hashtag}: {str(e)}"
                            logger.error(error_msg)
                            errors.append(error_msg)
                    for keyword in request.keywords:
                        if time.monotonic() >= deadline:
                            break
                        try:
                            leads = await scraper.scrape_search(
                                keyword,
                                max_profiles=BATCH_PER_SOURCE,
                                exclude_usernames=seen_usernames,
                            )
                            for lead in leads:
                                seen_usernames.add(lead["username"])
                                all_leads.append(lead)
                            if leads:
                                logger.info(f"TikTok search '{keyword}' (round {round_num}): +{len(leads)} leads")
                        except Exception as e:
                            error_msg = f"Error searching TikTok for {keyword}: {str(e)}"
                            logger.error(error_msg)
                            errors.append(error_msg)
                    matching = [l for l in all_leads if _lead_matches_location(l, request.location)]
                    elapsed = int(LOCATION_SEARCH_TIMEOUT_SEC - (deadline - time.monotonic()))
                    logger.info(
                        f"TikTok location round {round_num}: {len(all_leads)} total, {len(matching)} matching "
                        f"'{request.location}' (elapsed ~{elapsed}s)"
                    )
                    if len(matching) >= request.max_profiles:
                        break
                    if not (request.hashtags or request.keywords):
                        break
                if time.monotonic() >= deadline:
                    logger.info("TikTok location search stopped: 1 hour limit reached")
            else:
                for hashtag in request.hashtags:
                    try:
                        leads = await scraper.scrape_hashtag(
                            hashtag,
                            max_profiles=request.max_profiles,
                            exclude_usernames=client_exclude,
                        )
                        all_leads.extend(leads)
                        logger.info(f"TikTok hashtag #{hashtag}: found {len(leads)} leads")
                    except Exception as e:
                        errors.append(f"Error scraping TikTok hashtag {hashtag}: {str(e)}")
                for keyword in request.keywords:
                    try:
                        leads = await scraper.scrape_search(
                            keyword,
                            max_profiles=request.max_profiles,
                            exclude_usernames=client_exclude,
                        )
                        all_leads.extend(leads)
                        logger.info(f"TikTok search '{keyword}': found {len(leads)} leads")
                    except Exception as e:
                        errors.append(f"Error searching TikTok for {keyword}: {str(e)}")
            
        finally:
            await scraper.close()
    
    else:
        # Instagram scraping (default)
        accounts = [acc.model_dump() for acc in request.accounts]
        scraper = HumanLikeScraper(accounts, proxies)
        
        try:
            if not accounts:
                logger.warning("No Instagram scraping accounts provided; search may return 0 results (login required for topsearch)")
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

            has_location_filter = bool(request.location and request.location.strip())
            LOCATION_SEARCH_TIMEOUT_SEC = 3600  # 1 hora
            BATCH_PER_SOURCE = 15
            MIN_SCROLL_TIMES = 5

            # Nunca incluir as contas de login nem leads que o cliente já tem
            login_usernames = {a.get("username") for a in accounts if a.get("username")}
            client_exclude = set(request.exclude_usernames or [])
            if client_exclude:
                logger.info(f"Excluding {len(client_exclude)} existing client lead(s) so we only return new ones")
            if login_usernames:
                logger.info(f"Excluding login account(s) from leads: {login_usernames}")
            initial_exclude = login_usernames | client_exclude

            if has_location_filter:
                # Loop até completar a lista solicitada ou 1h: busca perfis, filtra por cidade, repete
                deadline = time.monotonic() + LOCATION_SEARCH_TIMEOUT_SEC
                seen_usernames: Set[str] = set(initial_exclude)
                round_num = 0
                logger.info(
                    f"Location filter active: will search up to 1h until {request.max_profiles} leads match '{request.location}'"
                )
                while time.monotonic() < deadline:
                    matching = [l for l in all_leads if _lead_matches_location(l, request.location)]
                    if len(matching) >= request.max_profiles:
                        logger.info(f"Location target reached: {len(matching)} leads match '{request.location}'")
                        break
                    round_num += 1
                    scroll_times = MIN_SCROLL_TIMES + round_num * 3
                    for hashtag in request.hashtags:
                        if time.monotonic() >= deadline:
                            break
                        try:
                            leads = await scraper.scrape_hashtag(
                                hashtag,
                                max_profiles=BATCH_PER_SOURCE,
                                exclude_usernames=seen_usernames,
                                scroll_times=scroll_times,
                            )
                            for lead in leads:
                                seen_usernames.add(lead["username"])
                                if lead["username"] not in login_usernames:
                                    all_leads.append(lead)
                            if leads:
                                logger.info(f"Instagram hashtag #{hashtag} (round {round_num}): +{len(leads)} leads")
                        except Exception as e:
                            error_msg = f"Error scraping hashtag {hashtag}: {str(e)}"
                            logger.error(error_msg)
                            errors.append(error_msg)
                    for keyword in request.keywords:
                        if time.monotonic() >= deadline:
                            break
                        try:
                            leads = await scraper.scrape_search(
                                keyword,
                                max_profiles=BATCH_PER_SOURCE,
                                exclude_usernames=seen_usernames,
                            )
                            for lead in leads:
                                seen_usernames.add(lead["username"])
                                if lead["username"] not in login_usernames:
                                    all_leads.append(lead)
                            if leads:
                                logger.info(f"Instagram search '{keyword}' (round {round_num}): +{len(leads)} leads")
                        except Exception as e:
                            error_msg = f"Error searching Instagram for {keyword}: {str(e)}"
                            logger.error(error_msg)
                            errors.append(error_msg)
                    matching = [l for l in all_leads if _lead_matches_location(l, request.location)]
                    elapsed = int(LOCATION_SEARCH_TIMEOUT_SEC - (deadline - time.monotonic()))
                    logger.info(
                        f"Location search round {round_num}: {len(all_leads)} total, {len(matching)} matching "
                        f"'{request.location}' (elapsed ~{elapsed}s, limit 1h)"
                    )
                    if len(matching) >= request.max_profiles:
                        break
                    if not (request.hashtags or request.keywords):
                        break
                if time.monotonic() >= deadline:
                    logger.info("Location search stopped: 1 hour limit reached")
            else:
                # Sem filtro de cidade: excluir contas de login e leads que o cliente já tem; continuar até ter max_profiles novos
                fetch_per_source = request.max_profiles
                for hashtag in request.hashtags:
                    try:
                        leads = await scraper.scrape_hashtag(
                            hashtag,
                            max_profiles=fetch_per_source,
                            exclude_usernames=initial_exclude,
                        )
                        for lead in leads:
                            if lead["username"] not in login_usernames:
                                all_leads.append(lead)
                        logger.info(f"Instagram hashtag #{hashtag}: found {len(leads)} leads")
                    except Exception as e:
                        error_msg = f"Error scraping hashtag {hashtag}: {str(e)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
                for keyword in request.keywords:
                    try:
                        leads = await scraper.scrape_search(
                            keyword,
                            max_profiles=fetch_per_source,
                            exclude_usernames=initial_exclude,
                        )
                        for lead in leads:
                            if lead["username"] not in login_usernames:
                                all_leads.append(lead)
                        logger.info(f"Instagram search '{keyword}': found {len(leads)} leads")
                    except Exception as e:
                        error_msg = f"Error searching Instagram for {keyword}: {str(e)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
            
        finally:
            await scraper.close()
    
    # Se há filtro de cidade: continuar buscando até atingir o limite de leads que batem com a localidade
    # (na primeira passada já pedimos mais candidatos por fonte; aqui só filtramos e limitamos)
    if request.location and request.location.strip():
        before = len(all_leads)
        all_leads = [l for l in all_leads if _lead_matches_location(l, request.location)]
        logger.info(f"Location filter '{request.location}': {before} -> {len(all_leads)} leads")
    
    # Normalize and remove duplicates
    seen_usernames = set()
    unique_leads = []
    for lead in all_leads:
        if lead['username'] not in seen_usernames:
            seen_usernames.add(lead['username'])
            normalized = normalize_lead(lead, platform)
            unique_leads.append(LeadResult(**normalized))
    
    unique_leads = unique_leads[:request.max_profiles]
    
    return ScrapeResponse(
        success=len(unique_leads) > 0,
        leads=unique_leads,
        total_found=len(unique_leads),
        platform=platform,
        errors=errors
    )

@app.get("/scrape/profile/{username}")
async def scrape_single_profile(username: str, platform: str = "instagram"):
    """Scrape a single profile by username"""
    
    if platform.lower() == "tiktok":
        scraper = TikTokScraper([])
    else:
        scraper = HumanLikeScraper([], [])
    
    try:
        await scraper.setup_browser()
        result = await scraper.scrape_profile(username)
        
        if result:
            result['platform'] = platform.lower()
            return {
                "success": True,
                "profile": LeadResult(**result, source="direct")
            }
        else:
            return {
                "success": False,
                "error": f"Could not fetch {platform} profile for @{username}"
            }
    finally:
        await scraper.close()

@app.get("/scrape/tiktok/profile/{username}")
async def scrape_tiktok_profile(username: str):
    """Scrape a single TikTok profile"""
    scraper = TikTokScraper([])
    
    try:
        await scraper.setup_browser()
        result = await scraper.scrape_profile(username)
        
        if result:
            return {
                "success": True,
                "profile": LeadResult(**result, source="direct", platform="tiktok")
            }
        else:
            return {
                "success": False,
                "error": f"Could not fetch TikTok profile for @{username}"
            }
    finally:
        await scraper.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SCRAPER_PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)
