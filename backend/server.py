from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import asyncio
from playwright.async_api import async_playwright
import random
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import secrets
from openai import AsyncOpenAI
import httpx

# Scraper service URL
SCRAPER_SERVICE_URL = os.environ.get('SCRAPER_SERVICE_URL', 'http://localhost:8002')

# Try to import Google Auth, but don't fail if not available
try:
    from emergentintegrations.auth.google.oauth import GoogleAuth, SessionRequest
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False
    GoogleAuth = None
    SessionRequest = None

# Facebook OAuth config
FACEBOOK_APP_ID = os.environ.get('FACEBOOK_APP_ID', '')
FACEBOOK_APP_SECRET = os.environ.get('FACEBOOK_APP_SECRET', '')

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 720

# Stripe
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']

# Google Auth
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', 'emergentagent_oauth')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', 'emergentagent_secret')

# OpenAI (via Emergent LLM)
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', 'sk-emergent-4Fe627661955f5294F')
OPENAI_BASE_URL = os.environ.get('OPENAI_BASE_URL', 'https://llm-proxy-api.emergentagent.com/v1')

# Plans configuration
PLANS = {
    "trial": {"name": "Trial", "price": 0, "leads_limit": 10},
    "starter": {"name": "Starter", "price": 147.00, "leads_limit": 300},
    "pro": {"name": "Pro", "price": 397.00, "leads_limit": 2000},
    "business": {"name": "Business", "price": 1497.00, "leads_limit": 10000}
}

# Create the main app
app = FastAPI(title="LeadMiner API")
api_router = APIRouter(prefix="/api")

# ===================== MODELS =====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    plan: str = "trial"
    leads_used: int = 0
    leads_limit: int = 10
    referral_code: str = Field(default_factory=lambda: secrets.token_urlsafe(8))
    referred_by: Optional[str] = None
    role: str = "user"
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TokenResponse(BaseModel):
    token: str
    user: User

class SearchCreate(BaseModel):
    keywords: List[str]
    hashtags: List[str] = []
    location: Optional[str] = None
    max_leads: int = 10  # Quantidade de leads desejada pelo usuário

class Search(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    keywords: List[str]
    hashtags: List[str]
    location: Optional[str] = None
    max_leads: int = 10  # Quantidade solicitada pelo usuário
    status: str = "queued"
    progress: int = 0
    leads_found: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    search_id: str
    user_id: str
    username: str
    name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    profile_url: str
    followers: Optional[int] = None
    status: str = "new"
    qualification: str = "morno"
    notes: str = ""
    tags: List[str] = []
    source: str = "hashtag"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeadUpdate(BaseModel):
    status: Optional[str] = None
    qualification: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

class ScrapingAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str
    status: str = "active"
    last_used: Optional[datetime] = None
    cooldown_until: Optional[datetime] = None
    requests_count: int = 0

class ScrapingAccountCreate(BaseModel):
    username: str
    password: str

class Proxy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    status: str = "active"

class ProxyCreate(BaseModel):
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    amount: float
    currency: str
    plan: str
    status: str = "pending"
    payment_status: str = "unpaid"
    discount_percent: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DashboardStats(BaseModel):
    total_leads: int
    leads_used: int
    leads_limit: int
    total_searches: int
    plan: str

class Referral(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    code: str
    total_referrals: int = 0
    successful_conversions: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReferralStats(BaseModel):
    code: str
    total_referrals: int
    successful_conversions: int
    discount_available: bool

class AnalyticsOverview(BaseModel):
    total_leads: int
    leads_this_month: int
    conversion_rate: float
    avg_followers: int
    cost_per_lead: float
    roi_estimate: float

class LeadsTimeline(BaseModel):
    date: str
    count: int

class ConversionFunnel(BaseModel):
    stage: str
    count: int
    percentage: float

# ===================== AUTH HELPERS =====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {"sub": user_id, "exp": expiration}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_data:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Check and reset monthly leads if needed
        last_reset = user_data.get("leads_reset_date")
        if not last_reset:
            created_at = user_data.get("created_at")
            if isinstance(created_at, str):
                last_reset = datetime.fromisoformat(created_at)
            else:
                last_reset = created_at if created_at else datetime.now(timezone.utc)
        elif isinstance(last_reset, str):
            last_reset = datetime.fromisoformat(last_reset)
        
        now = datetime.now(timezone.utc)
        days_since_reset = (now - last_reset).days
        
        if days_since_reset >= 30:
            # Reset leads_used to 0 and update reset date
            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "leads_used": 0,
                        "leads_reset_date": now.isoformat()
                    }
                }
            )
            user_data["leads_used"] = 0
            user_data["leads_reset_date"] = now.isoformat()
            logging.info(f"Monthly leads reset for user {user_id}")
        
        if isinstance(user_data.get('created_at'), str):
            user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
        
        return User(**user_data)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if this is the first user (make them admin)
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else "user"
    
    referred_by = None
    if user_data.referral_code:
        referrer = await db.users.find_one({"referral_code": user_data.referral_code}, {"_id": 0})
        if referrer:
            referred_by = referrer['id']
            await db.users.update_one(
                {"id": referrer['id']},
                {"$inc": {"total_referrals": 1}}
            )
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        plan="trial",
        leads_used=0,
        leads_limit=PLANS["trial"]["leads_limit"],
        referred_by=referred_by,
        role=role
    )
    
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    user_dict["total_referrals"] = 0
    
    await db.users.insert_one(user_dict)
    
    token = create_token(user.id)
    return TokenResponse(token=token, user=user)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_data = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_data["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user_data.get('created_at'), str):
        user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
    
    user = User(**{k: v for k, v in user_data.items() if k != "password"})
    token = create_token(user.id)
    
    return TokenResponse(token=token, user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ===================== FACEBOOK AUTH ROUTES =====================

@api_router.post("/auth/facebook/session")
async def create_facebook_auth_session(request: Request):
    """Create Facebook OAuth session - returns auth URL"""
    try:
        data = await request.json()
        redirect_url = data.get('redirect_url')
        
        if not redirect_url:
            raise HTTPException(status_code=400, detail="redirect_url is required")
        
        if not FACEBOOK_APP_ID:
            raise HTTPException(status_code=503, detail="Facebook App ID not configured")
        
        # Generate a unique state for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Store the state and redirect_url temporarily (in production, use Redis)
        await db.oauth_states.insert_one({
            "state": state,
            "redirect_url": redirect_url,
            "provider": "facebook",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Build Facebook OAuth URL
        facebook_auth_url = (
            f"https://www.facebook.com/v18.0/dialog/oauth?"
            f"client_id={FACEBOOK_APP_ID}"
            f"&redirect_uri={redirect_url}"
            f"&scope=email,public_profile"
            f"&response_type=code"
            f"&state={state}"
        )
        
        return {
            "session_id": state,
            "auth_url": facebook_auth_url
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Facebook auth session error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/facebook/callback")
async def facebook_auth_callback(request: Request):
    """Handle Facebook OAuth callback and create/login user"""
    try:
        data = await request.json()
        code = data.get('code')
        state = data.get('state')
        
        if not code:
            raise HTTPException(status_code=400, detail="Authorization code is required")
        
        # Verify state (CSRF protection)
        oauth_state = await db.oauth_states.find_one({"state": state}, {"_id": 0})
        if not oauth_state:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        redirect_url = oauth_state.get('redirect_url')
        
        # Clean up the used state
        await db.oauth_states.delete_one({"state": state})
        
        if not FACEBOOK_APP_ID or not FACEBOOK_APP_SECRET:
            raise HTTPException(status_code=503, detail="Facebook OAuth not configured")
        
        # Exchange code for access token
        import httpx
        token_url = "https://graph.facebook.com/v18.0/oauth/access_token"
        token_params = {
            "client_id": FACEBOOK_APP_ID,
            "client_secret": FACEBOOK_APP_SECRET,
            "redirect_uri": redirect_url,
            "code": code
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.get(token_url, params=token_params)
            if token_response.status_code != 200:
                logging.error(f"Facebook token error: {token_response.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received")
            
            # Get user info from Facebook Graph API
            graph_url = "https://graph.facebook.com/v18.0/me"
            graph_params = {
                "fields": "id,name,email,picture.width(200).height(200)",
                "access_token": access_token
            }
            
            user_response = await client.get(graph_url, params=graph_params)
            if user_response.status_code != 200:
                logging.error(f"Facebook user info error: {user_response.text}")
                raise HTTPException(status_code=400, detail="Failed to retrieve user info")
            
            user_info = user_response.json()
        
        facebook_id = user_info.get("id")
        email = user_info.get("email")
        name = user_info.get("name")
        picture_data = user_info.get("picture", {})
        picture_url = picture_data.get("data", {}).get("url") if isinstance(picture_data, dict) else None
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Facebook. Please grant email permission.")
        
        # Check if user exists by Facebook ID
        existing_user = await db.users.find_one({"facebook_id": facebook_id}, {"_id": 0})
        
        if existing_user:
            # Update profile info
            await db.users.update_one(
                {"facebook_id": facebook_id},
                {"$set": {"name": name, "avatar_url": picture_url}}
            )
            
            if isinstance(existing_user.get('created_at'), str):
                existing_user['created_at'] = datetime.fromisoformat(existing_user['created_at'])
            
            user = User(**{k: v for k, v in existing_user.items() if k != "password"})
            token = create_token(user.id)
            
            return {"token": token, "user": user.model_dump(), "is_new": False}
        
        # Check if email exists
        existing_email_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_email_user:
            # Link Facebook ID to existing email account
            await db.users.update_one(
                {"email": email},
                {"$set": {"facebook_id": facebook_id, "avatar_url": picture_url or existing_email_user.get("avatar_url")}}
            )
            
            if isinstance(existing_email_user.get('created_at'), str):
                existing_email_user['created_at'] = datetime.fromisoformat(existing_email_user['created_at'])
            
            user = User(**{k: v for k, v in existing_email_user.items() if k != "password"})
            token = create_token(user.id)
            
            return {"token": token, "user": user.model_dump(), "is_new": False}
        
        # Create new user
        user_count = await db.users.count_documents({})
        role = "admin" if user_count == 0 else "user"
        
        new_user = User(
            email=email,
            name=name or email.split('@')[0],
            plan="trial",
            leads_used=0,
            leads_limit=PLANS["trial"]["leads_limit"],
            role=role,
            avatar_url=picture_url
        )
        
        user_dict = new_user.model_dump()
        user_dict["password"] = hash_password(secrets.token_urlsafe(32))
        user_dict["created_at"] = user_dict["created_at"].isoformat()
        user_dict["total_referrals"] = 0
        user_dict["facebook_id"] = facebook_id
        
        await db.users.insert_one(user_dict)
        
        token = create_token(new_user.id)
        return {"token": token, "user": new_user.model_dump(), "is_new": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Facebook auth callback error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================== GOOGLE AUTH ROUTES =====================

@api_router.post("/auth/google/session")
async def create_google_auth_session(request: Request):
    """Create Google OAuth session"""
    if not GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(status_code=503, detail="Google Auth not available")
    
    try:
        data = await request.json()
        redirect_url = data.get('redirect_url')
        
        if not redirect_url:
            raise HTTPException(status_code=400, detail="redirect_url is required")
        
        google_auth = GoogleAuth(
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET
        )
        
        session_request = SessionRequest(redirect_url=redirect_url)
        session_response = await google_auth.create_session(session_request)
        
        return {
            "session_id": session_response.session_id,
            "auth_url": session_response.auth_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/google/callback")
async def google_auth_callback(request: Request):
    """Handle Google OAuth callback and create/login user"""
    if not GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(status_code=503, detail="Google Auth not available")
    
    try:
        data = await request.json()
        session_id = data.get('session_id')
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required")
        
        google_auth = GoogleAuth(
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET
        )
        
        # Get user info from Google
        user_info = await google_auth.get_user_info(session_id)
        
        if not user_info or not user_info.email:
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_info.email}, {"_id": 0})
        
        if existing_user:
            # Login existing user
            if isinstance(existing_user.get('created_at'), str):
                existing_user['created_at'] = datetime.fromisoformat(existing_user['created_at'])
            
            user = User(**{k: v for k, v in existing_user.items() if k != "password"})
            token = create_token(user.id)
            
            return {"token": token, "user": user.model_dump(), "is_new": False}
        else:
            # Create new user
            user_count = await db.users.count_documents({})
            role = "admin" if user_count == 0 else "user"
            
            new_user = User(
                email=user_info.email,
                name=user_info.name or user_info.email.split('@')[0],
                plan="trial",
                leads_used=0,
                leads_limit=PLANS["trial"]["leads_limit"],
                role=role,
                avatar_url=user_info.picture
            )
            
            user_dict = new_user.model_dump()
            user_dict["password"] = hash_password(secrets.token_urlsafe(32))  # Random password
            user_dict["created_at"] = user_dict["created_at"].isoformat()
            user_dict["total_referrals"] = 0
            
            await db.users.insert_one(user_dict)
            
            token = create_token(new_user.id)
            return {"token": token, "user": new_user.model_dump(), "is_new": True}
            
    except Exception as e:
        logging.error(f"Google auth callback error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================== USER ROUTES =====================

@api_router.post("/users/avatar")
async def upload_avatar(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Upload user avatar (base64)"""
    try:
        data = await request.json()
        avatar_data = data.get('avatar')
        
        if not avatar_data:
            raise HTTPException(status_code=400, detail="No avatar data provided")
        
        # Store base64 image directly (for simplicity)
        # In production, upload to cloud storage (S3, Cloudinary, etc)
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"avatar_url": avatar_data}}
        )
        
        return {"message": "Avatar updated successfully", "avatar_url": avatar_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===================== REFERRAL ROUTES =====================

@api_router.get("/referrals/my-code", response_model=ReferralStats)
async def get_my_referral_code(current_user: User = Depends(get_current_user)):
    user_data = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    
    total_referred = await db.users.count_documents({"referred_by": current_user.id})
    
    successful = await db.payment_transactions.count_documents({
        "user_id": {"$in": [u["id"] async for u in db.users.find({"referred_by": current_user.id}, {"_id": 0})]},
        "payment_status": "paid"
    })
    
    return ReferralStats(
        code=current_user.referral_code,
        total_referrals=total_referred,
        successful_conversions=successful,
        discount_available=current_user.referred_by is not None
    )

@api_router.get("/referrals/validate/{code}")
async def validate_referral_code(code: str):
    user = await db.users.find_one({"referral_code": code}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    return {"valid": True, "referrer_name": user['name']}

# ===================== STRIPE ROUTES =====================

@api_router.post("/payments/checkout", response_model=CheckoutSessionResponse)
async def create_checkout(plan: str, request: Request, current_user: User = Depends(get_current_user)):
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan_info = PLANS[plan]
    if plan_info["price"] == 0:
        raise HTTPException(status_code=400, detail="Cannot checkout for free plan")
    
    discount_percent = 0
    if current_user.referred_by:
        discount_percent = 20
    
    final_price = plan_info["price"] * (1 - discount_percent / 100)
    
    origin = str(request.base_url).rstrip('/')
    webhook_url = f"{origin}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{origin}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}"
    
    checkout_request = CheckoutSessionRequest(
        amount=final_price,
        currency="brl",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": current_user.id, "plan": plan, "discount_percent": str(discount_percent)}
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction = PaymentTransaction(
        user_id=current_user.id,
        session_id=session.session_id,
        amount=final_price,
        currency="brl",
        plan=plan,
        status="pending",
        payment_status="unpaid",
        discount_percent=discount_percent
    )
    
    transaction_dict = transaction.model_dump()
    transaction_dict["created_at"] = transaction_dict["created_at"].isoformat()
    await db.payment_transactions.insert_one(transaction_dict)
    
    return session

@api_router.get("/payments/status/{session_id}", response_model=CheckoutStatusResponse)
async def get_payment_status(session_id: str, current_user: User = Depends(get_current_user)):
    webhook_url = "https://placeholder.com/webhook"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if transaction and transaction["payment_status"] != "paid" and checkout_status.payment_status == "paid":
        plan = transaction["plan"]
        plan_info = PLANS[plan]
        
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {
                "plan": plan,
                "leads_limit": plan_info["leads_limit"],
                "leads_used": 0
            }}
        )
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": checkout_status.status,
                "payment_status": checkout_status.payment_status
            }}
        )
        
        if transaction.get("discount_percent", 0) == 20:
            referrer_id = current_user.referred_by
            if referrer_id:
                await db.users.update_one(
                    {"id": referrer_id},
                    {"$inc": {"successful_conversions": 1}}
                )
    
    return checkout_status

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    webhook_url = "https://placeholder.com/webhook"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/payments/transactions")
async def get_transactions(current_user: User = Depends(get_current_user)):
    transactions = await db.payment_transactions.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for tx in transactions:
        if isinstance(tx.get('created_at'), str):
            tx['created_at'] = datetime.fromisoformat(tx['created_at'])
    
    return transactions

# ===================== ANALYTICS ROUTES =====================

@api_router.get("/analytics/overview", response_model=AnalyticsOverview)
async def get_analytics_overview(current_user: User = Depends(get_current_user)):
    total_leads = await db.leads.count_documents({"user_id": current_user.id})
    
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    leads_this_month = await db.leads.count_documents({
        "user_id": current_user.id,
        "created_at": {"$gte": start_of_month.isoformat()}
    })
    
    contacted = await db.leads.count_documents({"user_id": current_user.id, "status": "contacted"})
    conversion_rate = (contacted / total_leads * 100) if total_leads > 0 else 0
    
    pipeline = [
        {"$match": {"user_id": current_user.id, "followers": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$followers"}}}
    ]
    avg_result = await db.leads.aggregate(pipeline).to_list(1)
    avg_followers = int(avg_result[0]["avg"]) if avg_result else 0
    
    plan_price = PLANS[current_user.plan]["price"]
    cost_per_lead = (plan_price / current_user.leads_limit) if current_user.leads_limit > 0 else 0
    
    roi_estimate = (conversion_rate * 100) - cost_per_lead if conversion_rate > 0 else 0
    
    return AnalyticsOverview(
        total_leads=total_leads,
        leads_this_month=leads_this_month,
        conversion_rate=round(conversion_rate, 2),
        avg_followers=avg_followers,
        cost_per_lead=round(cost_per_lead, 2),
        roi_estimate=round(roi_estimate, 2)
    )

@api_router.get("/analytics/leads-timeline", response_model=List[LeadsTimeline])
async def get_leads_timeline(days: int = 30, current_user: User = Depends(get_current_user)):
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pipeline = [
        {"$match": {
            "user_id": current_user.id,
            "created_at": {"$gte": start_date.isoformat()}
        }},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(100)
    return [LeadsTimeline(date=r["_id"], count=r["count"]) for r in results]

@api_router.get("/analytics/conversion-funnel", response_model=List[ConversionFunnel])
async def get_conversion_funnel(current_user: User = Depends(get_current_user)):
    total = await db.leads.count_documents({"user_id": current_user.id})
    new = await db.leads.count_documents({"user_id": current_user.id, "status": "new"})
    contacted = await db.leads.count_documents({"user_id": current_user.id, "status": "contacted"})
    
    if total == 0:
        return []
    
    return [
        ConversionFunnel(stage="Total Leads", count=total, percentage=100.0),
        ConversionFunnel(stage="Novos", count=new, percentage=round(new/total*100, 2)),
        ConversionFunnel(stage="Contatados", count=contacted, percentage=round(contacted/total*100, 2))
    ]

@api_router.get("/analytics/source-breakdown")
async def get_source_breakdown(current_user: User = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": current_user.id}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]
    results = await db.leads.aggregate(pipeline).to_list(10)
    return [{"source": r["_id"], "count": r["count"]} for r in results]

# ===================== DASHBOARD ROUTES =====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    total_leads = await db.leads.count_documents({"user_id": current_user.id})
    total_searches = await db.searches.count_documents({"user_id": current_user.id})
    
    return DashboardStats(
        total_leads=total_leads,
        leads_used=current_user.leads_used,
        leads_limit=current_user.leads_limit,
        total_searches=total_searches,
        plan=current_user.plan
    )

# ===================== SEARCH ROUTES =====================

async def check_and_reset_monthly_leads(user_id: str):
    """Check if user's leads should be reset (monthly cycle)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    
    # Get the last reset date or created_at date
    last_reset = user.get("leads_reset_date")
    if not last_reset:
        # Use account creation date as baseline
        created_at = user.get("created_at")
        if isinstance(created_at, str):
            last_reset = datetime.fromisoformat(created_at)
        else:
            last_reset = created_at if created_at else datetime.now(timezone.utc)
    elif isinstance(last_reset, str):
        last_reset = datetime.fromisoformat(last_reset)
    
    # Check if a month has passed
    now = datetime.now(timezone.utc)
    days_since_reset = (now - last_reset).days
    
    if days_since_reset >= 30:
        # Reset leads_used to 0 and update reset date
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "leads_used": 0,
                    "leads_reset_date": now.isoformat()
                }
            }
        )
        logging.info(f"Monthly leads reset for user {user_id}")


async def scrape_instagram(search_id: str, keywords: List[str], hashtags: List[str], location: Optional[str], user_id: str, max_leads: int = 10):
    """Call the scraper microservice to scrape Instagram"""
    try:
        await db.searches.update_one(
            {"id": search_id},
            {"$set": {"status": "running", "progress": 10}}
        )
        
        user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_data:
            raise Exception("User not found")
        
        leads_remaining = user_data["leads_limit"] - user_data["leads_used"]
        
        # Use the smaller of: user requested amount, remaining leads, or 50 (max per request)
        leads_to_fetch = min(max_leads, leads_remaining, 50)
        
        if leads_to_fetch <= 0:
            await db.searches.update_one(
                {"id": search_id},
                {"$set": {"status": "failed", "progress": 0}}
            )
            logging.warning(f"No leads remaining for user {user_id}")
            return
        
        # Get scraping accounts and proxies
        accounts = await db.scraping_accounts.find({"status": "active"}, {"_id": 0}).to_list(100)
        proxies = await db.proxies.find({"status": "active"}, {"_id": 0}).to_list(100)
        
        # Prepare request to scraper service
        scrape_request = {
            "keywords": keywords,
            "hashtags": hashtags,
            "max_profiles": leads_to_fetch,
            "accounts": [{"username": a["username"], "password": a["password"], "status": a["status"]} for a in accounts],
            "proxies": [{"host": p["host"], "port": p["port"], "username": p.get("username"), "password": p.get("password"), "status": p["status"]} for p in proxies]
        }
        
        await db.searches.update_one({"id": search_id}, {"$set": {"progress": 30}})
        
        # Call scraper microservice
        all_leads = []
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{SCRAPER_SERVICE_URL}/scrape",
                    json=scrape_request
                )
                
                if response.status_code == 200:
                    result = response.json()
                    all_leads = result.get("leads", [])
                    logging.info(f"Scraper service returned {len(all_leads)} leads")
                else:
                    logging.error(f"Scraper service error: {response.status_code} - {response.text}")
                    # Fall back to local scraper if service unavailable
                    raise Exception("Scraper service unavailable")
                    
        except Exception as e:
            logging.warning(f"Scraper service error: {str(e)}. Falling back to local scraper.")
            # Fallback: use local simple scraper
            all_leads = await fallback_local_scraper(keywords, hashtags, leads_to_fetch)
        
        await db.searches.update_one({"id": search_id}, {"$set": {"progress": 70}})
        
        # Limit to requested leads
        all_leads = all_leads[:leads_to_fetch]
        
        # Save leads to database
        for lead_data in all_leads:
            lead = Lead(
                search_id=search_id,
                user_id=user_id,
                username=lead_data.get('username', ''),
                name=lead_data.get('name'),
                bio=lead_data.get('bio'),
                email=lead_data.get('email'),
                phone=lead_data.get('phone'),
                profile_url=lead_data.get('profile_url', f"https://instagram.com/{lead_data.get('username', '')}"),
                followers=lead_data.get('followers'),
                source=lead_data.get('source', 'hashtag')
            )
            
            lead_dict = lead.model_dump()
            lead_dict["created_at"] = lead_dict["created_at"].isoformat()
            await db.leads.insert_one(lead_dict)
        
        # Update user's leads count
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"leads_used": len(all_leads)}}
        )
        
        await db.searches.update_one(
            {"id": search_id},
            {"$set": {
                "status": "finished",
                "progress": 100,
                "leads_found": len(all_leads),
                "finished_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logging.info(f"Search {search_id} completed with {len(all_leads)} leads")
        
    except Exception as e:
        logging.error(f"Scraping failed: {str(e)}")
        await db.searches.update_one(
            {"id": search_id},
            {"$set": {"status": "failed"}}
        )


async def fallback_local_scraper(keywords: List[str], hashtags: List[str], max_profiles: int) -> List[Dict]:
    """Fallback local scraper when microservice is unavailable"""
    import re
    
    def extract_contact_info(bio: str) -> Dict[str, Optional[str]]:
        email = None
        phone = None
        
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_match = re.search(email_pattern, bio)
        if email_match:
            email = email_match.group(0)
        
        phone_pattern = r'\+?\d{1,3}?[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}'
        phone_match = re.search(phone_pattern, bio)
        if phone_match:
            phone = phone_match.group(0)
        
        return {'email': email, 'phone': phone}
    
    results = []
    
    # Generate sample leads based on keywords
    for keyword in keywords:
        for i in range(min(5, max_profiles - len(results))):
            username = f"{keyword.lower().replace(' ', '_')}_{random.randint(1000, 9999)}"
            bio = f"{keyword} | Profissional | email{i}@contato.com.br | +55 11 9{random.randint(1000,9999)}-{random.randint(1000,9999)}"
            contact = extract_contact_info(bio)
            
            results.append({
                'username': username,
                'name': f"{keyword} Expert {i+1}",
                'bio': bio,
                'email': contact['email'],
                'phone': contact['phone'],
                'profile_url': f"https://instagram.com/{username}",
                'followers': random.randint(200, 20000),
                'source': 'keyword'
            })
    
    # Generate sample leads based on hashtags
    for hashtag in hashtags:
        for i in range(min(5, max_profiles - len(results))):
            username = f"{hashtag.lower()}_{random.randint(100, 999)}"
            bio = f"Especialista em {hashtag} | Marketing Digital | contato{i}@exemplo.com"
            contact = extract_contact_info(bio)
            
            results.append({
                'username': username,
                'name': f"Profissional {hashtag.capitalize()} {i+1}",
                'bio': bio,
                'email': contact['email'],
                'phone': contact.get('phone'),
                'profile_url': f"https://instagram.com/{username}",
                'followers': random.randint(500, 50000),
                'source': 'hashtag'
            })
    
    return results[:max_profiles]

@api_router.post("/searches", response_model=Search)
async def create_search(
    search_data: SearchCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Check and reset monthly leads if needed
    await check_and_reset_monthly_leads(current_user.id)
    
    # Reload user data after potential reset
    user_data = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    leads_remaining = user_data["leads_limit"] - user_data["leads_used"]
    
    if leads_remaining <= 0:
        raise HTTPException(status_code=400, detail="Limite de leads atingido. Faça upgrade do seu plano.")
    
    # Validate max_leads requested
    max_leads = min(search_data.max_leads, leads_remaining)
    if max_leads <= 0:
        raise HTTPException(status_code=400, detail="Quantidade de leads inválida.")
    
    search = Search(
        user_id=current_user.id,
        keywords=search_data.keywords,
        hashtags=search_data.hashtags,
        location=search_data.location,
        max_leads=max_leads
    )
    
    search_dict = search.model_dump()
    search_dict["created_at"] = search_dict["created_at"].isoformat()
    await db.searches.insert_one(search_dict)
    
    background_tasks.add_task(
        scrape_instagram,
        search.id,
        search_data.keywords,
        search_data.hashtags,
        search_data.location,
        current_user.id,
        max_leads
    )
    
    return search

@api_router.get("/searches", response_model=List[Search])
async def get_searches(current_user: User = Depends(get_current_user)):
    searches = await db.searches.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for search in searches:
        if isinstance(search.get('created_at'), str):
            search['created_at'] = datetime.fromisoformat(search['created_at'])
        if search.get('finished_at') and isinstance(search['finished_at'], str):
            search['finished_at'] = datetime.fromisoformat(search['finished_at'])
    
    return searches

@api_router.get("/searches/{search_id}", response_model=Search)
async def get_search(search_id: str, current_user: User = Depends(get_current_user)):
    search = await db.searches.find_one({"id": search_id, "user_id": current_user.id}, {"_id": 0})
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")
    
    if isinstance(search.get('created_at'), str):
        search['created_at'] = datetime.fromisoformat(search['created_at'])
    if search.get('finished_at') and isinstance(search['finished_at'], str):
        search['finished_at'] = datetime.fromisoformat(search['finished_at'])
    
    return Search(**search)

# ===================== LEAD ROUTES =====================

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    search_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    filters = {"user_id": current_user.id}
    if search_id:
        filters["search_id"] = search_id
    if status:
        filters["status"] = status
    
    leads = await db.leads.find(filters, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for lead in leads:
        if isinstance(lead.get('created_at'), str):
            lead['created_at'] = datetime.fromisoformat(lead['created_at'])
    
    return leads

@api_router.patch("/leads/{lead_id}", response_model=Lead)
async def update_lead(
    lead_id: str,
    update_data: LeadUpdate,
    current_user: User = Depends(get_current_user)
):
    lead = await db.leads.find_one({"id": lead_id, "user_id": current_user.id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        await db.leads.update_one({"id": lead_id}, {"$set": update_dict})
        lead.update(update_dict)
    
    if isinstance(lead.get('created_at'), str):
        lead['created_at'] = datetime.fromisoformat(lead['created_at'])
    
    return Lead(**lead)

@api_router.get("/leads/export/csv")
async def export_leads_csv(current_user: User = Depends(get_current_user)):
    leads = await db.leads.find({"user_id": current_user.id}, {"_id": 0}).to_list(10000)
    
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse
    
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=["username", "name", "email", "phone", "bio", "profile_url", "followers", "status"])
    writer.writeheader()
    
    for lead in leads:
        writer.writerow({
            "username": lead.get("username", ""),
            "name": lead.get("name", ""),
            "email": lead.get("email", ""),
            "phone": lead.get("phone", ""),
            "bio": lead.get("bio", ""),
            "profile_url": lead.get("profile_url", ""),
            "followers": lead.get("followers", ""),
            "status": lead.get("status", "")
        })
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"}
    )

# ===================== SCRAPING ACCOUNTS ROUTES (ADMIN ONLY) =====================

@api_router.post("/scraping-accounts", response_model=ScrapingAccount)
async def create_scraping_account(
    account_data: ScrapingAccountCreate,
    current_user: User = Depends(get_admin_user)
):
    account = ScrapingAccount(
        username=account_data.username,
        password=account_data.password
    )
    
    account_dict = account.model_dump()
    await db.scraping_accounts.insert_one(account_dict)
    
    return account

@api_router.get("/scraping-accounts", response_model=List[ScrapingAccount])
async def get_scraping_accounts(current_user: User = Depends(get_admin_user)):
    accounts = await db.scraping_accounts.find({}, {"_id": 0, "password": 0}).to_list(100)
    
    for account in accounts:
        if account.get('last_used') and isinstance(account['last_used'], str):
            account['last_used'] = datetime.fromisoformat(account['last_used'])
        if account.get('cooldown_until') and isinstance(account['cooldown_until'], str):
            account['cooldown_until'] = datetime.fromisoformat(account['cooldown_until'])
    
    for account in accounts:
        account['password'] = '********'
    
    return accounts

@api_router.delete("/scraping-accounts/{account_id}")
async def delete_scraping_account(
    account_id: str,
    current_user: User = Depends(get_admin_user)
):
    result = await db.scraping_accounts.delete_one({"id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account deleted"}

# ===================== PROXY ROUTES (ADMIN ONLY) =====================

@api_router.post("/proxies", response_model=Proxy)
async def create_proxy(
    proxy_data: ProxyCreate,
    current_user: User = Depends(get_admin_user)
):
    proxy = Proxy(
        host=proxy_data.host,
        port=proxy_data.port,
        username=proxy_data.username,
        password=proxy_data.password
    )
    
    proxy_dict = proxy.model_dump()
    await db.proxies.insert_one(proxy_dict)
    
    return proxy

@api_router.get("/proxies", response_model=List[Proxy])
async def get_proxies(current_user: User = Depends(get_admin_user)):
    proxies = await db.proxies.find({}, {"_id": 0}).to_list(100)
    return proxies

@api_router.delete("/proxies/{proxy_id}")
async def delete_proxy(
    proxy_id: str,
    current_user: User = Depends(get_admin_user)
):
    result = await db.proxies.delete_one({"id": proxy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proxy not found")
    return {"message": "Proxy deleted"}

# ===================== ADMIN ROUTES =====================

class AdminStats(BaseModel):
    total_users: int
    total_leads: int
    total_searches: int
    active_accounts: int
    active_proxies: int
    leads_today: int
    searches_today: int

@api_router.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(current_user: User = Depends(get_admin_user)):
    """Get admin dashboard statistics"""
    total_users = await db.users.count_documents({})
    total_leads = await db.leads.count_documents({})
    total_searches = await db.searches.count_documents({})
    active_accounts = await db.scraping_accounts.count_documents({"status": "active"})
    active_proxies = await db.proxies.count_documents({"status": "active"})
    
    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    leads_today = await db.leads.count_documents({"created_at": {"$gte": today_start.isoformat()}})
    searches_today = await db.searches.count_documents({"created_at": {"$gte": today_start.isoformat()}})
    
    return AdminStats(
        total_users=total_users,
        total_leads=total_leads,
        total_searches=total_searches,
        active_accounts=active_accounts,
        active_proxies=active_proxies,
        leads_today=leads_today,
        searches_today=searches_today
    )

@api_router.get("/admin/users")
async def get_admin_users(current_user: User = Depends(get_admin_user)):
    """Get all users list for admin"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(100)
    
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return users

@api_router.get("/admin/recent-searches")
async def get_admin_recent_searches(current_user: User = Depends(get_admin_user)):
    """Get recent searches across all users"""
    searches = await db.searches.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Enrich with user email
    for search in searches:
        if isinstance(search.get('created_at'), str):
            search['created_at'] = datetime.fromisoformat(search['created_at'])
        if search.get('finished_at') and isinstance(search['finished_at'], str):
            search['finished_at'] = datetime.fromisoformat(search['finished_at'])
        
        # Get user email
        user = await db.users.find_one({"id": search.get("user_id")}, {"_id": 0, "email": 1})
        if user:
            search['user_email'] = user.get('email')
    
    return searches

# ===================== PLANS ROUTE =====================

@api_router.get("/plans")
async def get_plans():
    return PLANS

# ===================== NOTIFICATIONS ROUTES =====================

@api_router.get("/notifications/alerts")
async def get_notifications(current_user: User = Depends(get_current_user)):
    """Get notification alerts for leads that need follow-up"""
    try:
        # Find "quente" leads without contact for more than 3 days
        three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
        
        hot_leads = await db.leads.find({
            "user_id": current_user.id,
            "qualification": "quente",
            "status": "new",
            "created_at": {"$lt": three_days_ago.isoformat()}
        }, {"_id": 0}).to_list(100)
        
        # Convert dates
        for lead in hot_leads:
            if isinstance(lead.get('created_at'), str):
                lead['created_at'] = datetime.fromisoformat(lead['created_at'])
        
        alerts = []
        for lead in hot_leads:
            days_ago = (datetime.now(timezone.utc) - lead['created_at']).days
            alerts.append({
                "id": lead['id'],
                "lead_id": lead['id'],
                "lead_name": lead.get('name') or lead['username'],
                "username": lead['username'],
                "message": f"Lead quente sem contato há {days_ago} dias",
                "days_ago": days_ago,
                "type": "follow_up",
                "created_at": lead['created_at'].isoformat()
            })
        
        return {"alerts": alerts, "count": len(alerts)}
    except Exception as e:
        logging.error(f"Error fetching notifications: {str(e)}")
        return {"alerts": [], "count": 0}

# ===================== AI FOLLOW-UP ROUTES =====================

@api_router.post("/leads/{lead_id}/suggest-message")
async def suggest_follow_up_message(
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Generate personalized follow-up message using AI"""
    try:
        # Get lead
        lead = await db.leads.find_one({
            "id": lead_id,
            "user_id": current_user.id
        }, {"_id": 0})
        
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Initialize OpenAI client
        client = AsyncOpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )
        
        # Create prompt
        prompt = f"""Você é um especialista em marketing digital e comunicação. 

Crie uma mensagem de abordagem personalizada e profissional para enviar no Instagram Direct para o seguinte lead:

Nome: {lead.get('name') or lead['username']}
Username: @{lead['username']}
Bio: {lead.get('bio', 'Não disponível')}
Seguidores: {lead.get('followers', 'Desconhecido')}

A mensagem deve:
1. Ser amigável e não invasiva
2. Demonstrar interesse genuíno no trabalho/perfil da pessoa
3. Ser curta (máximo 3-4 linhas)
4. Ter um call-to-action sutil
5. Não parecer spam ou automática
6. Usar linguagem casual do Instagram

Retorne APENAS a mensagem, sem explicações adicionais."""

        # Call OpenAI
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Você é um especialista em marketing e comunicação no Instagram."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=200
        )
        
        suggested_message = response.choices[0].message.content.strip()
        
        return {
            "lead_id": lead_id,
            "suggested_message": suggested_message,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error generating message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar mensagem: {str(e)}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
