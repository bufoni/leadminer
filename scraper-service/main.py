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
    location: Optional[str] = None  # optional; used when platform supports it
    max_profiles: int = 20
    exclude_usernames: Optional[List[str]] = None  # leads que o cliente já tem; scraper ignora e continua até achar novos
    accounts: List[AccountConfig] = []
    proxies: List[ProxyConfig] = []
    platform: str = "instagram"  # "instagram" or "tiktok"

class LeadResult(BaseModel):
    username: str
    name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    profile_image_url: Optional[str] = None  # URL da foto de perfil
    location: Optional[str] = None  # cidade/região (extraído da bio ou campo)
    profile_url: str
    followers: Optional[int] = None
    following: Optional[int] = None
    posts: Optional[int] = None
    likes: Optional[int] = None  # TikTok specific
    videos: Optional[int] = None  # TikTok specific
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
        
        # Phone patterns
        phone_patterns = [
            r'\+?\d{1,3}?[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}',
            r'\(\d{2}\)\s*\d{4,5}-?\d{4}',
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
                        
                        # Extract contact info from bio
                        if result['bio']:
                            contact = self.extract_contact_info(result['bio'])
                            result['email'] = contact['email']
                            result['phone'] = contact['phone']
                        
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
        # Email
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
        m = re.search(email_pattern, text, re.IGNORECASE)
        if m:
            email = m.group(0)
        # Telefone: (86) 99999-9999, 86999999999, +55 86..., wa.me/5586999999999
        phone_patterns = [
            r'[☎\s]*\(?\s*\d{2}\s*\)?\s*[-.\s]*\d{4,5}\s*[-.]?\s*\d{4}',
            r'(?:\+55\s*)?\(?\s*0?\s*\d{2}\s*\)?\s*[-.\s]*\d{4,5}\s*[-.]?\s*\d{4}',
            r'\d{2}\s*\d{4,5}[-.\s]?\d{4}',
            r'\+?\d{1,3}[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}',
            r'(?:whatsapp|wa|tel)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}',
            r'\b\d{10,11}\b',  # 11999999999 ou 86999999999
        ]
        for pattern in phone_patterns:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                phone = re.sub(r'\s+', ' ', m.group(0).strip())
                if len(phone) >= 10:  # evita números curtos tipo "44 posts"
                    break
                phone = None
        # wa.me/5586999999999 ou api.whatsapp.com/send?phone=... → usar como contato (telefone implícito)
        wa_match = re.search(r'(?:wa\.me/|api\.whatsapp\.com/send\?phone=)(\d{10,14})', text, re.IGNORECASE)
        if wa_match and not phone:
            phone = '+' + wa_match.group(1)
        # Site/link (http/https e short links como abrir.link)
        url_pattern = r'https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s]*)?'
        short_link = re.search(r'(?:https?://)?(?:[a-zA-Z0-9-]+\.(?:link|page|co|io))/[A-Za-z0-9]+', text)
        url_match = re.search(url_pattern, text)
        if url_match:
            url = url_match.group(0).rstrip('.,;:)')
            if not any(x in url.lower() for x in ['instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com', 'youtube.com', 'wa.me', 'api.whatsapp']):
                website = url
        if not website and short_link:
            website = short_link.group(0) if short_link.group(0).startswith('http') else 'https://' + short_link.group(0)
        return {'email': email, 'phone': phone, 'website': website}

    def _extract_location_from_bio(self, bio: str) -> Optional[str]:
        """Extrai cidade/região da bio. Suporta Floriano-PI, endereços completos, etc."""
        if not bio or not bio.strip():
            return None
        text = bio.strip()
        # Padrão pin + cidade-estado: "📍Floriano-PI" ou "Floriano-PI" ou "São Paulo-SP"
        pin_city_state = re.search(
            r'[📍\s]*([A-Za-zÀ-ÿ\s]+)[-\s]+([A-Za-z]{2})\b',
            text,
            re.IGNORECASE
        )
        if pin_city_state:
            city = pin_city_state.group(1).strip()
            state_abbr = pin_city_state.group(2).strip().upper()
            if 2 <= len(city) <= 50 and len(state_abbr) == 2 and not city.lower().startswith('http'):
                state_names = {'PI': 'Piauí', 'SP': 'São Paulo', 'RJ': 'Rio de Janeiro', 'MG': 'Minas Gerais',
                              'BA': 'Bahia', 'PE': 'Pernambuco', 'CE': 'Ceará', 'RS': 'Rio Grande do Sul',
                              'PR': 'Paraná', 'SC': 'Santa Catarina', 'GO': 'Goiás', 'AM': 'Amazonas'}
                state = state_names.get(state_abbr, state_abbr)
                return f"{city}, {state}"
        # Endereço completo: "Rua X, 123, Bairro, Cidade, Estado, Brazil CEP"
        addr = re.search(
            r',\s*([A-Za-zÀ-ÿ\s]+),\s*([A-Za-zÀ-ÿ\s]+?)(?:,\s*Brazil)?(?:\s+\d{5,8})?\s*$',
            text,
            re.MULTILINE | re.IGNORECASE
        )
        if addr:
            city = addr.group(1).strip()
            state = addr.group(2).strip()
            if len(city) >= 2 and len(state) >= 2 and not state.isdigit():
                return f"{city}, {state}"
        # "Campinas, São Paulo" ou "Floriano, Piaui"
        city_state = re.search(
            r'([A-Za-zÀ-ÿ\s]+),\s*([A-Za-zÀ-ÿ\s]{2,30})\s*(?:\d{5})?',
            text
        )
        if city_state:
            c, s = city_state.group(1).strip(), city_state.group(2).strip()
            if 2 <= len(c) <= 40 and 2 <= len(s) <= 30 and not c.lower().startswith('http'):
                return f"{c}, {s}"
        # Fallback: "em Campinas", "Dentista em Campinas"
        em = re.search(r'\b(?:em|,)\s+([A-Za-zÀ-ÿ\s]{2,40}?)(?:\s*[-|]\s|\.|$|\n)', text, re.IGNORECASE)
        if em:
            loc = em.group(1).strip()
            if not loc.startswith('http') and not re.search(r'^\d', loc):
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
        """Faz apenas o login por formulário (sem verificar sessão). Usado quando a hashtag redireciona para login."""
        try:
            logger.info("Going to login page (form login)...")
            await self.page.goto('https://www.instagram.com/accounts/login/', wait_until='load', timeout=45000)
            await self.human_delay(5, 8)

            # Instagram é React; esperar a página estabilizar
            username_input = None
            password_input = None
            used_locators = False  # True se usamos get_by_label (preenche com .fill())

            # 1) Tentar fluxo por label (get_by_label + .fill()) – mais estável no Instagram
            for user_label in ["Phone number, username, or email", "Telefone, nome de usuário ou e-mail", "Username", "Phone"]:
                try:
                    user_loc = self.page.get_by_label(user_label, exact=False)
                    n = await user_loc.count()
                    if n > 0:
                        pwd_loc = self.page.get_by_label("Password", exact=False)
                        if await pwd_loc.count() == 0:
                            pwd_loc = self.page.get_by_label("Senha", exact=False)
                        if await pwd_loc.count() > 0:
                            logger.info(f"Using label flow: username label '{user_label}'")
                            await user_loc.first.click()
                            await self.human_delay(0.3, 0.6)
                            await user_loc.first.fill(account['username'])
                            await self.human_delay(1, 2)
                            await pwd_loc.first.click()
                            await self.human_delay(0.3, 0.6)
                            await pwd_loc.first.fill(account['password'])
                            await self.human_delay(1, 2)
                            used_locators = True
                            break
                except Exception as e:
                    logger.debug(f"Label flow failed ({user_label}): {e}")
                    continue

            # 2) Fallback: seletores CSS + human_type
            if not used_locators:
                for selector in [
                    'input[name="username"]',
                    'input[aria-label*="username"]',
                    'input[aria-label*="Phone"]',
                    'input[aria-label*="email"]',
                    'input[aria-label*="Telefone"]',
                    'input[autocomplete="username"]',
                    'form input[type="text"]',
                ]:
                    try:
                        username_input = await self.page.wait_for_selector(selector, timeout=4000, state='visible')
                        if username_input:
                            logger.info(f"Found username input: {selector}")
                            break
                    except Exception:
                        continue
                if not username_input:
                    username_input = await self.page.query_selector('form input[type="text"]')
                if not username_input:
                    logger.error("Could not find username input")
                    await self.page.screenshot(path='/tmp/login_debug.png')
                    return False
                await username_input.click()
                await self.human_delay(0.5, 1.0)
                logger.info(f"Typing username: {account['username']}")
                await self.human_type(username_input, account['username'])
                await self.human_delay(1, 2)
                for sel in ['input[name="password"]', 'input[type="password"]']:
                    try:
                        password_input = await self.page.query_selector(sel)
                        if password_input:
                            await password_input.click()
                            await self.human_delay(0.5, 1.0)
                            logger.info("Typing password...")
                            await self.human_type(password_input, account['password'])
                            await self.human_delay(1, 2)
                            break
                    except Exception:
                        continue
            
            await self.move_mouse_randomly(self.page)
            await self.human_delay(0.5, 1.0)

            # Botão de login: por role/label primeiro, depois seletores
            submit_clicked = False
            for name in ["Log in", "Entrar", "Log in", "Login"]:
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
                for selector in ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("Entrar")', 'div[role="button"]:has-text("Log in")']:
                    try:
                        submit_btn = await self.page.query_selector(selector)
                        if submit_btn:
                            await submit_btn.click()
                            logger.info("Clicked login button (selector)")
                            break
                    except Exception:
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
                logger.info("Form login successful!")
                return True
            logger.warning("Form login may have failed")
            return False
        except Exception as e:
            logger.error(f"Form login error: {str(e)}")
            return False

    async def scrape_profile(self, username: str) -> Optional[Dict]:
        """Scrape a single Instagram profile with human-like behavior"""
        try:
            logger.info(f"Scraping profile: @{username}")
            
            # Navigate to profile (domcontentloaded saves proxy data)
            await self.page.goto(f'https://www.instagram.com/{username}/', wait_until='domcontentloaded', timeout=30000)
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
                    'website': None,
                    'profile_image_url': None,
                    'location': None,
                    'profile_url': f'https://instagram.com/{username}',
                    'followers': None,
                    'following': None,
                    'posts': None,
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
                'website': None,
                'profile_image_url': None,
                'location': None,
                'profile_url': f'https://instagram.com/{username}',
                'followers': None,
                'following': None,
                'posts': None,
            }

            def _parse_count(s: str) -> Optional[int]:
                if not s:
                    return None
                s = s.replace(',', '').replace('.', '').replace(' ', '').strip()
                if 'K' in s.upper():
                    try:
                        return int(float(s.upper().replace('K', '').replace('M', '')) * 1000)
                    except ValueError:
                        return None
                if 'M' in s.upper():
                    try:
                        return int(float(s.upper().replace('M', '')) * 1000000)
                    except ValueError:
                        return None
                if 'mil' in s.lower():
                    s = s.lower().replace('mil', '')
                nums = re.findall(r'\d+', s)
                return int(nums[0]) if nums else None

            # Tentar extrair do JSON embutido (biografia, foto, stats)
            try:
                embed = await self.page.evaluate(
                    r'() => { const scripts = document.querySelectorAll("script"); '
                    r'for (const s of scripts) { const t = s.textContent || ""; '
                    r'if (!t.includes("edge_followed_by")) continue; '
                    r'const fr = t.match(/"edge_followed_by":\s*\{\s*"count":\s*(\d+)/); '
                    r'const fg = t.match(/"edge_follow":\s*\{\s*"count":\s*(\d+)/); '
                    r'const po = t.match(/"edge_owner_to_timeline_media":\s*\{\s*"count":\s*(\d+)/); '
                    r'let bio = null; const bi = t.indexOf(\'"biography":"\'); '
                    r'if (bi >= 0) { let start = bi + 12, end = start, esc = false; '
                    r'while (end < t.length) { const c = t[end]; if (esc) { esc = false; end++; continue; } '
                    r'if (c === "\\\\") { esc = true; end++; continue; } if (c === \'"\') break; end++; } '
                    r'bio = t.slice(start, end).replace(/\\\\n/g, "\\n").replace(/\\\\"/g, \'"\').replace(/\\\\\\\\/g, "\\\\"); } '
                    r'let pic = null; const p = t.match(/"profile_pic_url(?:_hd)?":\s*"([^"]+)"/); if (p) pic = p[1]; '
                    r'return { followers: fr ? parseInt(fr[1],10) : null, following: fg ? parseInt(fg[1],10) : null, posts: po ? parseInt(po[1],10) : null, biography: bio, profile_pic_url: pic }; } '
                    r'return null; }'
                )
                if embed:
                    if embed.get('followers') is not None:
                        result['followers'] = embed['followers']
                    if embed.get('following') is not None:
                        result['following'] = embed['following']
                    if embed.get('posts') is not None:
                        result['posts'] = embed['posts']
                    if embed.get('biography'):
                        raw_bio = embed['biography']
                        if isinstance(raw_bio, str):
                            try:
                                raw_bio = raw_bio.encode().decode('unicode_escape')
                            except Exception:
                                pass
                        result['bio'] = raw_bio
                        contact = self.extract_contact_info(result['bio'])
                        result['email'] = contact.get('email')
                        result['phone'] = contact.get('phone')
                        result['website'] = result['website'] or contact.get('website')
                        result['location'] = self._extract_location_from_bio(result['bio'])
                    if embed.get('profile_pic_url'):
                        result['profile_image_url'] = embed['profile_pic_url']
            except Exception as e:
                logger.debug(f"Embed JSON extraction: {e}")

            # Get page text content for analysis
            body_text = ""
            try:
                body_text = await self.page.inner_text('body')
            except Exception as e:
                logger.debug(f"Error getting body text: {e}")

            # Extrair posts, followers, following do texto (fallback; só preenche se ainda estiver None)
            try:
                if body_text:
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
            except Exception as e:
                logger.debug(f"Error extracting stats from text: {e}")
            
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
            
            # Expandir "mais" na bio se existir (para pegar texto completo)
            if result.get('bio') is None:
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
            # Extrair bio do DOM (se ainda não veio do embed) — vários seletores para pegar texto completo
            if result.get('bio') is None:
                try:
                    stats_line = re.compile(
                        r'^[\d.,\sKkMm]+(?:posts?|seguidores?|following|seguindo|publicações?)$',
                        re.IGNORECASE
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
                                t = await elem.inner_text()
                                if not t or len(t) <= 2:
                                    continue
                                t = t.strip()
                                if t in ('mais', 'more', '...'):
                                    continue
                                if stats_line.match(t):
                                    continue
                                # Evita duplicar e ignora trechos que já estão contidos em outro
                                if t in seen or any(t in s or s in t for s in seen if len(t) > 5 and len(s) > 5):
                                    continue
                                if len(t) > 500:  # provavelmente pegou o bloco inteiro
                                    bio_parts = [t]
                                    break
                                seen.add(t)
                                bio_parts.append(t)
                            except Exception:
                                continue
                        if len(bio_parts) == 1 and len(bio_parts[0]) > 500:
                            break
                    if bio_parts:
                        full_bio = '\n'.join(bio_parts) if len(bio_parts) > 1 else bio_parts[0]
                        # Remove estatísticas no meio do texto (ex.: "417 posts", "1.327 seguidores")
                        full_bio = re.sub(
                            r'[\s\n]*[\d.,KkMm]+\s*(?:posts?|seguidores?|following|seguindo|publicações?)[\s\n]*',
                            ' ', full_bio, flags=re.IGNORECASE
                        )
                        full_bio = re.sub(r'\n\s*\n', '\n', full_bio).strip()
                        if len(full_bio) > 10:
                            result['bio'] = full_bio
                            contact = self.extract_contact_info(full_bio)
                            result['email'] = result['email'] or contact.get('email')
                            result['phone'] = result['phone'] or contact.get('phone')
                            result['website'] = result['website'] or contact.get('website')
                            if result.get('location') is None:
                                result['location'] = self._extract_location_from_bio(full_bio)
                except Exception:
                    pass
            # Foto de perfil (fallback se não veio do embed)
            if result.get('profile_image_url') is None:
                try:
                    img = await self.page.query_selector('header img[src*="cdninstagram"], header img[src*="fbcdn"]')
                    if img:
                        src = await img.get_attribute('src')
                        if src and 'http' in src:
                            result['profile_image_url'] = src
                except Exception:
                    pass
            # Link do perfil (Instagram: campo "site" separado)
            if result.get('website') is None:
                try:
                    link_elem = await self.page.query_selector('header section a[href^="http"]')
                    if link_elem:
                        href = await link_elem.get_attribute('href')
                        if href and not any(x in href for x in ['instagram.com', 'facebook.com', 'l.instagram.com']):
                            result['website'] = href.strip()
                except Exception:
                    pass
            
            # Fallback: extrair por selectors (links do header: posts, followers, following)
            try:
                # Instagram: linha de stats costuma ser header ul li ou section com links
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
                    if '/followers' in href or 'followers' in href.lower():
                        if result['followers'] is None:
                            result['followers'] = val
                    elif '/following' in href or 'following' in href.lower():
                        if result['following'] is None:
                            result['following'] = val
                # Posts: às vezes é o primeiro item (link para o perfil ou sem href específico)
                if result['posts'] is None:
                    for sel in ['a[href*="/"][role="link"] span', 'header ul li span', 'section ul li span']:
                        elems = await self.page.query_selector_all(sel)
                        for elem in elems:
                            t = await elem.inner_text()
                            if re.match(r'^[\d,.KkMm]+$', t.strip()):
                                v = _parse_count(t)
                                if v is not None and result['posts'] is None:
                                    result['posts'] = v
                                    break
                        if result['posts'] is not None:
                            break
            except Exception:
                pass

            # Simulate reading the profile
            await self.human_scroll(self.page, times=1)
            await self.human_delay(1, 2)

            logger.info(
                f"Scraped @{username}: name={result['name']}, followers={result['followers']}, "
                f"following={result['following']}, posts={result['posts']}"
            )
            return result
            
        except Exception as e:
            logger.error(f"Error scraping profile @{username}: {str(e)}")
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

# ===================== API ENDPOINTS =====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "scraper", "version": "2.0.0"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_profiles(request: ScrapeRequest):
    """Main scraping endpoint - supports Instagram and TikTok"""
    platform = request.platform.lower()
    logger.info(f"Received scrape request for {platform}: {len(request.keywords)} keywords, {len(request.hashtags)} hashtags")
    
    proxies = [proxy.model_dump() for proxy in request.proxies]
    all_leads = []
    errors = []
    
    if platform == "tiktok":
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
    
    # Remove duplicates
    seen_usernames = set()
    unique_leads = []
    for lead in all_leads:
        if lead['username'] not in seen_usernames:
            seen_usernames.add(lead['username'])
            lead['platform'] = platform
            if 'posts' not in lead:
                lead['posts'] = None
            if 'website' not in lead:
                lead['website'] = None
            if 'profile_image_url' not in lead:
                lead['profile_image_url'] = None
            if 'location' not in lead:
                lead['location'] = None
            unique_leads.append(LeadResult(**lead))
    
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
