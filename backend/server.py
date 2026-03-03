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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TokenResponse(BaseModel):
    token: str
    user: User

class SearchCreate(BaseModel):
    keywords: List[str]
    hashtags: List[str] = []
    location: Optional[str] = None

class Search(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    keywords: List[str]
    hashtags: List[str]
    location: Optional[str] = None
    status: str = "queued"  # queued, running, finished, failed
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
    status: str = "new"  # new, contacted, discarded
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeadUpdate(BaseModel):
    status: Optional[str] = None
    tags: Optional[List[str]] = None

class ScrapingAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str
    status: str = "active"  # active, cooldown, disabled
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
    status: str = "active"  # active, disabled

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DashboardStats(BaseModel):
    total_leads: int
    leads_used: int
    leads_limit: int
    total_searches: int
    plan: str

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
        
        if isinstance(user_data.get('created_at'), str):
            user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
        
        return User(**user_data)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        plan="trial",
        leads_used=0,
        leads_limit=PLANS["trial"]["leads_limit"]
    )
    
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    
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

# ===================== STRIPE ROUTES =====================

@api_router.post("/payments/checkout", response_model=CheckoutSessionResponse)
async def create_checkout(plan: str, request: Request, current_user: User = Depends(get_current_user)):
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan_info = PLANS[plan]
    if plan_info["price"] == 0:
        raise HTTPException(status_code=400, detail="Cannot checkout for free plan")
    
    # Get origin from request
    origin = str(request.base_url).rstrip('/')
    
    # Create Stripe checkout
    webhook_url = f"{origin}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{origin}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}"
    
    checkout_request = CheckoutSessionRequest(
        amount=plan_info["price"],
        currency="brl",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": current_user.id, "plan": plan}
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction
    transaction = PaymentTransaction(
        user_id=current_user.id,
        session_id=session.session_id,
        amount=plan_info["price"],
        currency="brl",
        plan=plan,
        status="pending",
        payment_status="unpaid"
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
    
    # Update transaction in database
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if transaction and transaction["payment_status"] != "paid" and checkout_status.payment_status == "paid":
        # Update user plan
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

async def scrape_instagram(search_id: str, keywords: List[str], hashtags: List[str], location: Optional[str], user_id: str):
    """Background task to scrape Instagram"""
    try:
        # Update search status to running
        await db.searches.update_one(
            {"id": search_id},
            {"$set": {"status": "running", "progress": 0}}
        )
        
        # Get user to check limits
        user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_data:
            raise Exception("User not found")
        
        leads_remaining = user_data["leads_limit"] - user_data["leads_used"]
        
        # Get accounts and proxies
        accounts = await db.scraping_accounts.find({"status": "active"}, {"_id": 0}).to_list(100)
        proxies = await db.proxies.find({"status": "active"}, {"_id": 0}).to_list(100)
        
        # Simulate scraping (in production, use real Playwright scraping)
        leads_to_create = min(random.randint(5, 15), leads_remaining)
        
        for i in range(leads_to_create):
            lead = Lead(
                search_id=search_id,
                user_id=user_id,
                username=f"user_{random.randint(1000, 9999)}",
                name=f"Sample User {i+1}",
                bio=f"Sample bio for lead {i+1}",
                email=f"sample{i+1}@example.com",
                phone=f"+55 11 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
                profile_url=f"https://instagram.com/user_{random.randint(1000, 9999)}",
                followers=random.randint(100, 10000)
            )
            
            lead_dict = lead.model_dump()
            lead_dict["created_at"] = lead_dict["created_at"].isoformat()
            await db.leads.insert_one(lead_dict)
            
            # Update progress
            progress = int((i + 1) / leads_to_create * 100)
            await db.searches.update_one(
                {"id": search_id},
                {"$set": {"progress": progress}}
            )
            
            # Simulate delay
            await asyncio.sleep(0.5)
        
        # Update user leads count
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"leads_used": leads_to_create}}
        )
        
        # Mark search as finished
        await db.searches.update_one(
            {"id": search_id},
            {"$set": {
                "status": "finished",
                "progress": 100,
                "leads_found": leads_to_create,
                "finished_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
    except Exception as e:
        logging.error(f"Scraping failed: {str(e)}")
        await db.searches.update_one(
            {"id": search_id},
            {"$set": {"status": "failed"}}
        )

@api_router.post("/searches", response_model=Search)
async def create_search(
    search_data: SearchCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Check if user has reached limit
    if current_user.leads_used >= current_user.leads_limit:
        raise HTTPException(status_code=400, detail="Lead limit reached. Upgrade your plan.")
    
    # Create search
    search = Search(
        user_id=current_user.id,
        keywords=search_data.keywords,
        hashtags=search_data.hashtags,
        location=search_data.location
    )
    
    search_dict = search.model_dump()
    search_dict["created_at"] = search_dict["created_at"].isoformat()
    await db.searches.insert_one(search_dict)
    
    # Start background scraping
    background_tasks.add_task(
        scrape_instagram,
        search.id,
        search_data.keywords,
        search_data.hashtags,
        search_data.location,
        current_user.id
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

# ===================== SCRAPING ACCOUNTS ROUTES =====================

@api_router.post("/scraping-accounts", response_model=ScrapingAccount)
async def create_scraping_account(
    account_data: ScrapingAccountCreate,
    current_user: User = Depends(get_current_user)
):
    account = ScrapingAccount(
        username=account_data.username,
        password=account_data.password
    )
    
    account_dict = account.model_dump()
    await db.scraping_accounts.insert_one(account_dict)
    
    return account

@api_router.get("/scraping-accounts", response_model=List[ScrapingAccount])
async def get_scraping_accounts(current_user: User = Depends(get_current_user)):
    accounts = await db.scraping_accounts.find({}, {"_id": 0, "password": 0}).to_list(100)
    
    for account in accounts:
        if account.get('last_used') and isinstance(account['last_used'], str):
            account['last_used'] = datetime.fromisoformat(account['last_used'])
        if account.get('cooldown_until') and isinstance(account['cooldown_until'], str):
            account['cooldown_until'] = datetime.fromisoformat(account['cooldown_until'])
    
    # Set password to empty for security
    for account in accounts:
        account['password'] = '********'
    
    return accounts

@api_router.delete("/scraping-accounts/{account_id}")
async def delete_scraping_account(
    account_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await db.scraping_accounts.delete_one({"id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account deleted"}

# ===================== PROXY ROUTES =====================

@api_router.post("/proxies", response_model=Proxy)
async def create_proxy(
    proxy_data: ProxyCreate,
    current_user: User = Depends(get_current_user)
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
async def get_proxies(current_user: User = Depends(get_current_user)):
    proxies = await db.proxies.find({}, {"_id": 0}).to_list(100)
    return proxies

@api_router.delete("/proxies/{proxy_id}")
async def delete_proxy(
    proxy_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await db.proxies.delete_one({"id": proxy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proxy not found")
    return {"message": "Proxy deleted"}

# ===================== PLANS ROUTE =====================

@api_router.get("/plans")
async def get_plans():
    return PLANS

# Include router
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