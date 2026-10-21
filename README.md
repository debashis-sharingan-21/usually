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
1. **Mathematical Isolation Guarantee:** User A's SQLite connection physically cannot query User B's file. SQL injection or misconfigured `WHERE user_id = ?` query bugs are physically impossible.
2. **Deterministic Financial Invariants:** Every user workspace runs the exact same double-entry accounting engine (`accounting.py`) and longitudinal habit detector (`habit_engine.py`) without modifying underlying ledger queries.
3. **Atomic Workspace Deletion:** When a user requests data deletion, Usually physically removes `workspace_<user_id>.db`, `-wal`, and `-shm` files from disk, leaving zero residual transaction traces.
4. **Session Authentication:** Authenticated via standard PBKDF2-HMAC-SHA256 hashed credentials or cryptographically random bearer session tokens (`secrets.token_urlsafe(32)`). Client-supplied user IDs are never trusted.

---

## Storage Transparency & Hosted Cloud Considerations

- **Local Self-Hosting:** When running Usually locally on your computer, your transactions are stored in local SQLite databases on your hard drive. Zero data is transmitted to external servers.
- **Hosted Cloud Instances (Railway / Render):**
  - **Persistent Volumes:** For persistent hosted multi-user workspaces, mount a persistent disk volume to `/data` (e.g. Railway Volume or Render Disk).
  - **Ephemeral Disk Reality:** On free-tier cloud containers without persistent volumes, instance restarts or spin-downs reset disk state. Hosted guest workspaces persist for the duration of the active container session. Usually explicitly discloses this in the application UI.

---

## Architectural Principles & Data Integrity

1. **Deterministic Financial Accounting:**
   - Pure mathematical calculations for income, living expenses, transfers, refunds, and pacing.
   - Credit card payoffs, self-transfers, and investment deposits are partitioned into transfer categories to prevent false inflation of consumption spending.
   - Enforces 16 mathematical accounting invariants covered by automated regression tests.
2. **Defensible Fingerprinting & Deduplication:**
   - Content-addressable SHA-256 fingerprinting distinguishes legitimate repeated transactions on the same day from identical duplicate statement re-imports.
3. **Evidence-Grounded Observations:**
   - Usually never outputs an observation unless the imported ledger strictly satisfies minimum longitudinal evidence criteria (frequency, cadence, confidence $\ge 0.5$, recency $\le 30$ days). Numbers are never hallucinated.
4. **Offline Deterministic Fallback:**
   - If a local Ollama instance (`gemma2:2b`) is online, it writes natural language headlines validated against verified evidence facts. If offline, Usually defaults seamlessly to built-in editorial templates with zero downtime.

---

## Local Installation (For Private Personal Data)

To analyze your personal bank or UPI statements privately with SQLite storage on your own computer:

### Prerequisites
- Python 3.10+ (tested on Python 3.11 and 3.13)
- Node.js 18+ (tested on Node v20 and v24)
- (Optional) [Ollama](https://ollama.com) running `gemma2:2b`

### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/debashis-sharingan-21/usually.git
cd usually

# Create and activate virtual environment
python -m venv backend/venv
source backend/venv/bin/activate  # On Windows: .\backend\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
Backend starts at `http://127.0.0.1:8000` with interactive API docs at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup
```bash
# In another terminal:
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. All parsing, local SQLite storage, and habit detection run strictly on your machine.

---

## Deployment Configuration

### A. Railway (Backend Deployment)

The backend runs as a containerized FastAPI application with an attached persistent volume for SQLite storage.

1. **Create Project:** On [Railway](https://railway.app), create a new project and connect the `debashis-sharingan-21/usually` GitHub repository.
2. **Configure Build:**
   - **Root Directory:** `/` (repo root) or `/backend`
   - **Dockerfile Path:** `backend/Dockerfile`
3. **Attach Persistent Storage Volume:**
   - Add a Volume to the backend service.
   - Set the mount path to: `/data`
   - *This ensures both the synthetic demo SQLite database (`/data/usually_demo.db`) and user workspaces (`/data/workspaces/`) persist across deployments.*
4. **Environment Variables:**
   - `USUALLY_DEPLOYMENT_MODE`: `hosted`
   - `USUALLY_DEMO_DB_PATH`: `/data/usually_demo.db`
   - `USUALLY_DATA_DIR`: `/data`
   - `USUALLY_ALLOWED_ORIGINS`: `https://your-app.vercel.app` (your Vercel frontend URL)
   - `PORT`: `8000`
5. **Healthcheck Endpoint:**
   - Healthcheck Path: `/health`
   - Returns: `{"status": "ok", "deployment_mode": "hosted", "database": "connected"}`

---

### B. Vercel (Frontend Deployment)

The Next.js App Router frontend deploys to Vercel and forwards `/api/*` requests to the Railway backend.

1. **Import Project:** On [Vercel](https://vercel.com), import the `debashis-sharingan-21/usually` repository.
2. **Configure Framework & Directory:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
3. **Environment Variables:**
   - `USUALLY_API_URL`: Your Railway backend domain (e.g. `https://usually-production.up.railway.app`)
4. **Deploy:** Click **Deploy**. Vercel will build the frontend with Turbopack and proxy all `/api/*` traffic cleanly to your Railway backend.

---

## Automated Test Suite

Usually maintains a test suite of **79 automated regression tests** covering accounting logic, CSV parsing, habit detection, database isolation, multi-tenant security, and user deletion.

```bash
# Run the entire test suite:
pytest backend/tests/ -v
```

### Key Test Suites:
- `test_user_isolation.py` (6 tests): Demonstrates physical multi-tenant isolation, cross-tenant mutation denial (HTTP 404), demo read-only enforcement (HTTP 403), user registration/login session lifecycle, and atomic workspace deletion.
- `test_public_demo.py` (12 tests): Demonstrates server-side read-only enforcement, public demo context pinning, personal database prohibition, idempotent synthetic seeding, and HTTP 403 rejection of all unauthenticated mutations.
- `test_financial_invariants.py` (16 tests): Validates mathematical purity, non-negative amounts, authoritative balance identity, and delimiter resilience.
- `test_database_isolation.py`: Guarantees physical segregation between demo and personal SQLite files.
- `test_csv_importer.py` & `test_phonepe_2026_parsing.py`: Verifies resilient parsing across standard CSV, TSV, semicolon, and PhonePe statement structures.
- `test_habits.py` & `test_notifications_endpoint.py`: Validates evidence-backed observation generation and 30-day recency windows.

---

## License

MIT License. Built for Hacktoberfest 2026.
