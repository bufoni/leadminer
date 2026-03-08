# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview
LeadMiner is a SaaS lead generation platform (Brazilian market, Portuguese UI). Architecture: React frontend (port 3000) + FastAPI backend (port 8001) + MongoDB + optional Playwright scraper service (port 8002).

### Starting Services

1. **MongoDB**: `mongod --dbpath /data/db --logpath /data/db/mongod.log --logappend --fork`
2. **Backend**: `cd /workspace/backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload` (requires `.env` with `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `STRIPE_API_KEY`)
3. **Frontend**: `cd /workspace/frontend && BROWSER=none yarn start` (requires `.env` with `REACT_APP_BACKEND_URL=http://localhost:8001`)

### Non-obvious Gotchas

- The backend requires `STRIPE_API_KEY` even for non-payment flows — it reads `os.environ['STRIPE_API_KEY']` at module level and crashes without it. A placeholder value like `sk_test_placeholder` is sufficient for local development.
- MongoDB log path `/var/log/mongod.log` may not be writable; use `--logpath /data/db/mongod.log --logappend` instead.
- Python packages install to `~/.local/bin` (no venv); ensure `PATH` includes `$HOME/.local/bin`.
- Frontend uses `yarn` (v1.22.22) as package manager and `craco` as build tool (not raw react-scripts).
- Frontend has no automated tests (no test files); `yarn test` exits with code 1 unless `--passWithNoTests` is used.
- Backend lint: `flake8 server.py --max-line-length=150` (existing warnings are in the codebase, not introduced by agent).
- Backend tests: `REACT_APP_BACKEND_URL=http://localhost:8001 pytest backend/tests/ -v` (requires running backend).
- The scraper service (port 8002) is optional — the backend has a built-in fallback scraper.

### Scraper Service Notes

- **Start**: `cd /workspace/scraper-service && uvicorn main:app --host 0.0.0.0 --port 8002` (requires `playwright install chromium` and `playwright install-deps chromium` first).
- **Platforms**: Instagram, TikTok, LinkedIn, Facebook. Instagram requires scraping accounts (stored in `db.scraping_accounts`).
- **Instagram login**: Instagram changed login form fields to `name="email"` and `name="pass"` with `div[role="button"]` submit. The scraper handles both old and new layouts. New device logins trigger `auth_platform/codeentry` verification — the scraper treats this as partial success and uses the API profile endpoint as fallback.
- **Instagram API profile**: `_try_api_profile()` uses `api/v1/users/web_profile_info/` endpoint (requires `X-IG-App-ID: 936619743392459` header) which works reliably with partial sessions.
- **Instagram keyword search** (`topsearch` API) requires a fully verified session — may return 0 results if the account hits a verification challenge.
- **TikTok**: No login needed. Profile data extracted from `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON script tag.
- **Data normalization**: All scrapers pass through `normalize_lead()` before returning, ensuring consistent field structure.
