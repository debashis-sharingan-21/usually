# Usually — Your Money Has Habits

> A quiet, local-first personal finance AI companion designed with a warm, editorial notebook aesthetic.
> Themed **“Slow and Steady”** with a peaceful sloth identity.

Usually is **not** a generic expense tracker or an annoying budgeting bot. It observes verified recurring rhythms in your transaction ledger (e.g., dining surges, commute patterns, subscription cadences) and turns them into concise, evidence-backed observations at your own pace.

---

## Two Ways to Experience Usually

Usually is designed with a strict, multi-tenant architecture that lets users freely explore the product:

| Feature / Capability | Synthetic Showcase Demo | Personal Private Workspace |
| :--- | :--- | :--- |
| **Purpose** | Immediate exploration of Usually's intelligence | Import your own statements & learn personal rhythms |
| **Data Source** | Realistic 6-month synthetic dataset (82 rows) | Your bank & UPI CSV statements (PhonePe, HDFC, SBI, etc.) |
| **Database Storage** | Persistent demo SQLite (`usually_demo.db`) | Isolated per-user SQLite (`workspaces/workspace_<user_id>.db`) |
| **Multi-Tenant Isolation** | Read-only synthetic showcase | Physical database segregation (zero cross-user contamination) |
| **Mutations & Edits** | Blocked (HTTP 403 Forbidden) | Full access: Import, Reconcile, Edit, Persistent Learning |
| **Entry Friction** | Zero (instant preview) | 1-Click Instant Guest Workspace or Account Sign In |
| **Privacy & Deletion** | Shared demonstration data | 1-Click permanent deletion (`DELETE /api/auth/workspace`) |

---

## Multi-Tenant Physical SQLite Isolation

Usually uses **per-user SQLite database files** rather than multi-tenant row flags:
1. **Physical File Isolation:** Each workspace is stored in an independent SQLite database file (`workspaces/workspace_<user_id>.db`). Database connections are resolved strictly from the authenticated session context, preventing cross-tenant leakage at the file-system level.
2. **Deterministic Financial Invariants:** Every user workspace runs deterministic accounting and reconciliation (`accounting.py`) and longitudinal habit detection (`habit_engine.py`) without modifying underlying ledger queries.
3. **Atomic Workspace Deletion:** When a user requests data deletion, Usually unlinks the database file (`workspace_<user_id>.db`) and removes associated `-wal` and `-shm` write-ahead log files from the server's workspace directory.
4. **Session Authentication:** Authenticated via standard PBKDF2-HMAC-SHA256 hashed credentials or cryptographically random bearer session tokens (`secrets.token_urlsafe(32)`). Client-supplied user IDs are never trusted.

---

## Storage Transparency & Hosted Cloud Considerations

- **Local Self-Hosting:** When running Usually locally on your computer, your transactions are stored in local SQLite databases on your hard drive. Zero financial data is transmitted to external servers.
- **Hosted Cloud Instances (Render / Vercel):**
  - **Persistent Volumes:** For persistent hosted multi-user workspaces, mount a persistent disk volume to `/data` (e.g. Render Persistent Disk).
  - **Ephemeral Disk Reality:** On free-tier cloud containers without persistent volumes, instance restarts or spin-downs reset disk state. Hosted guest workspaces persist for the duration of the active container session. Usually explicitly discloses this in the application UI.

---

## Architectural Principles & Gemma AI Integration

1. **Deterministic Accounting & Reconciliation:**
   - Pure mathematical calculations for income, living expenses, transfers, refunds, and pacing.
   - Credit card payoffs, self-transfers, and investment deposits are partitioned into transfer categories to prevent false inflation of consumption spending.
   - Enforces 16 mathematical accounting invariants covered by automated regression tests.
2. **Defensible Fingerprinting & Deduplication:**
   - Content-addressable SHA-256 fingerprinting distinguishes legitimate repeated transactions on the same day from identical duplicate statement re-imports.
3. **Assistive Merchant Suggestions (User-Confirmed):**
   - When importing statements with unfamiliar or ambiguous payees, Usually can consult local `gemma2:2b` to suggest candidate spending categories based on merchant descriptors.
   - **Review Required:** All model suggestions are clearly labeled as uncalibrated heuristic estimates (`Model estimate · Review required`). Transactions are never auto-reclassified without explicit user review.
   - **Persistent Memory:** Once approved or corrected, the user's decision is permanently stored in `learned_payees` with `user_classified = 1`. Subsequent statement imports match deterministically with **zero repeat model calls**.
4. **Evidence-Grounded Spending Pace & Habits:**
   - Pacing observations are strictly grounded in deterministic accounting facts (checkpoint day, month-to-date spend, historical baseline pace, and variance percentage).
   - Numerical claim validators verify that all amounts match extracted accounting facts within rounding tolerance.
   - Polarity checks reject contradictory claims (e.g. claiming spending "dropped" when pace is higher).
   - Guardrails reject invented psychological motives, emotional assumptions, or lifestyle claims (*"spending spree"*, *"fun October"*, *"treating yourself"*, *"vacation"*, *"splurge"*).
5. **Deterministic Engine Fallback:**
   - If local Ollama is offline, unreachable, or times out, or if generated text violates validation guardrails, Usually falls back seamlessly to its deterministic editorial engine with zero disruption.
   - **Local vs. Hosted Mode:** Local development with Ollama runs real `gemma2:2b` inference on-device. The hosted cloud backend (Render) currently operates without a local Ollama daemon and intentionally uses the deterministic engine fallback, transparently marked as `Deterministic Pattern Rules` in the UI.

---

## Local Installation & Verification (Local Private Data)

To analyze your personal bank or UPI statements privately with SQLite storage on your own computer:

### Prerequisites
- Python 3.10+ (tested on Python 3.11 and 3.13)
- Node.js 18+ (tested on Node v20 and v24)
- (Optional, for local AI) [Ollama](https://ollama.com) running `gemma2:2b`

### Local Windows Ollama & Gemma Setup
1. **Install Ollama for Windows:**
   - Download and run the Windows installer from [ollama.com/download/windows](https://ollama.com/download/windows).
   - Ensure Ollama is running in your system tray or run `ollama serve` in a terminal.
2. **Pull the Gemma 2B Model:**
   ```powershell
   ollama pull gemma2:2b
   ```
3. **Verify Local Model Availability:**
   ```powershell
   ollama list
   # Verify that gemma2:2b is listed
   curl http://localhost:11434/api/tags
   ```

### 1. Backend Setup
```powershell
# Clone the repository
git clone https://github.com/debashis-sharingan-21/usually.git
cd usually

# Create and activate virtual environment
python -m venv backend/venv
.\backend\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
Backend starts at `http://127.0.0.1:8000` with interactive API documentation at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup
```powershell
# In another terminal:
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. All parsing, local SQLite storage, habit detection, and local Gemma inferences run strictly on your machine.

### 3. Verify Genuine Gemma Inference
You can verify genuine local Gemma inference through Usually in three ways:
1. **Interactive UI Walkthrough:**
   - Open `http://localhost:3000`. The homepage observation header displays: `Gemma 2B · Grounded` and `Narrated by Gemma 2B (Local Ollama)` when the local model is online.
   - In **Financial Analysis**, the Spending Pace Benchmark displays: `Gemma Pace Interpretation` with `Local Ollama` badge.
   - In **Verified Ledger**, import a statement with an ambiguous payee. The review banner displays: `Gemma suggestion · review before saving` and `Model estimate · Review required`.
2. **Dedicated Automated E2E Walkthrough:**
   ```powershell
   .\backend\venv\Scripts\python scripts/verify_gemma_e2e.py
   ```
   Runs a 9-step automated end-to-end walkthrough verifying live model inference, question generation, user approval, persistent rule storage, zero-repeat inference on subsequent imports, manual overrides, motive guardrails, and non-destructive read-only personal database safety.
3. **Live Model Pytest Suite:**
   ```powershell
   .\backend\venv\Scripts\pytest backend/tests/test_live_gemma_e2e.py -v
   ```

---

## Deployment Configuration

Usually is deployed as a distributed web application: the FastAPI backend runs on **Render**, and the Next.js frontend runs on **Vercel**.

### A. Render (Backend Deployment)

The backend runs as a containerized Web Service on [Render](https://render.com).

1. **Create Web Service:** Connect your `debashis-sharingan-21/usually` GitHub repository.
2. **Configure Environment:**
   - **Environment:** Docker
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Docker Context:** `.` (repository root) or `backend`
   - Alternatively, deploy via Python native environment:
     - **Build Command:** `pip install -r backend/requirements.txt`
     - **Start Command:** `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
3. **Environment Variables:**
   - `USUALLY_DEPLOYMENT_MODE`: `hosted`
   - `USUALLY_DEMO_DB_PATH`: `/data/usually_demo.db` (or relative path in working directory)
   - `USUALLY_DATA_DIR`: `/data` (or attached Render persistent disk)
   - `USUALLY_ALLOWED_ORIGINS`: `https://your-app.vercel.app` (your Vercel frontend URL)
   - `PORT`: `10000` (Render default)
4. **Health Check Path:** `/health`
   - Returns: `{"status": "ok", "deployment_mode": "hosted", "database": "connected"}`

> **Note on Hosted Inference:** The hosted Render instance operates without an attached local GPU/Ollama daemon. In this environment, Usually transparently uses its built-in deterministic engine fallback for habit observations and pacing calculations. The production site never claims Gemma is active if Ollama is unreachable.

### B. Vercel (Frontend Deployment)

The Next.js App Router frontend deploys to [Vercel](https://vercel.com) and proxies all `/api/*` requests to the Render backend.

1. **Import Project:** Connect `debashis-sharingan-21/usually` on Vercel.
2. **Framework & Directory:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
3. **Environment Variables:**
   - `USUALLY_API_URL`: Your Render backend URL (e.g. `https://usually-backend.onrender.com`)
4. **Deploy:** Click **Deploy**. Next.js prerenders all static pages with Turbopack and rewrites `/api/:path*` to your Render service.

---

## Automated Test Suite

Usually maintains a comprehensive test suite of **103 backend automated tests** and **8 frontend unit tests** covering deterministic accounting logic, CSV parsing, habit detection, database isolation, multi-tenant security, user deletion, and Gemma AI guardrails.

### Test Commands
```powershell
# 1. Offline / CI Backend Suite (Zero external daemon requirements)
.\backend\venv\Scripts\pytest -m "not live_gemma" backend

# 2. Live Gemma Local Inference Suite (Requires local Ollama running gemma2:2b)
.\backend\venv\Scripts\pytest backend/tests/test_live_gemma_e2e.py -v

# 3. All Backend Tests (Runs live tests if Ollama available; safely skips if absent)
.\backend\venv\Scripts\pytest backend

# 4. Standalone Real-Gemma 9-Step Verification Walkthrough
.\backend\venv\Scripts\python scripts/verify_gemma_e2e.py

# 5. Frontend Unit Tests
npm test --prefix frontend

# 6. Frontend Lint & Build
npm run lint --prefix frontend
npm run build --prefix frontend
```

### Key Test Suites:
- `test_financial_invariants.py` (16 tests): Validates mathematical purity, non-negative amounts, authoritative balance identity, and delimiter resilience.
- `test_user_isolation.py` (9 tests): Demonstrates physical multi-tenant file isolation, cross-tenant mutation denial (HTTP 404), demo read-only enforcement (HTTP 403), session lifecycle, and atomic workspace deletion.
- `test_public_demo.py` (12 tests): Demonstrates server-side read-only enforcement, public demo context pinning, personal database prohibition, idempotent synthetic seeding, and HTTP 403 rejection of all unauthenticated mutations.
- `test_database_isolation.py` (2 tests): Guarantees physical segregation between demo and personal SQLite files.
- `test_csv_importer.py` & `test_phonepe_2026_parsing.py` (10 tests): Verifies resilient parsing across standard CSV, TSV, semicolon, and PhonePe statement formats.
- `test_habits.py` & `test_notifications_endpoint.py` (12 tests): Validates evidence-backed observation generation and 30-day recency windows.
- `test_ai_merchant_labeling.py` (11 tests): Verifies input sanitization against prompt injection, uncalibrated confidence labeling, unsupported spending motive rejection, directional polarity validation, user approval flows, and zero repeat model calls.
- `test_ai_fallback.py` (7 tests): Tests numeric claim validation against hallucinations, safe digits, and offline deterministic fallback.
- `test_live_gemma_e2e.py` (3 tests): Portable end-to-end integration tests executing against local `gemma2:2b`.

---

## License

MIT License. Built for Hacktoberfest 2026.
