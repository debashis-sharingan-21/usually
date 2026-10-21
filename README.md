# Usually — Your Money Has Habits

> A quiet, local-first personal finance AI companion designed with a warm, editorial notebook aesthetic.
> Themed **“Slow and Steady”** with a peaceful sloth identity.

Usually is **not** a generic expense tracker or a conversational budgeting bot. It observes verified recurring rhythms in your transaction ledger (e.g., dining surges, commute patterns, subscription cadences) and turns them into concise, evidence-backed observations at your own pace.

---

## Two Ways to Experience Usually

Usually is designed with a strict distinction between **Local Private Use** and the **Public Hosted Demo**:

| Feature / Capability | Local Development (Private Use) | Public Hosted Demo (Railway + Vercel) |
| :--- | :--- | :--- |
| **Data Source** | Personal bank & UPI CSV statements | Synthetic 6-month demonstration dataset |
| **Database Storage** | Local SQLite (`backend/data/usually.db`) | Persistent demo volume (`/data/usually_demo.db`) |
| **Privacy Isolation** | 100% on your machine (zero data leaves device) | Multi-layered server guard; personal DB prohibited |
| **CSV Import & Mapping** | Enabled (PhonePe, HDFC, SBI, generic CSVs) | Disabled (HTTP 403 Forbidden on server) |
| **Transaction Editing** | Enabled (change merchant, category, type) | Disabled (HTTP 403 Forbidden on server) |
| **Habit Feedback** | Enabled (Confirm, Mute, Persistent learning) | Disabled (Read-only showcase) |
| **AI Engine** | Local Ollama + Gemma 2b or deterministic rules | Offline deterministic fallback engine |

> [!IMPORTANT]
> **The Public Demo is NOT a multi-user service:** It intentionally serves synthetic data in read-only mode to demonstrate Usually's habit engine and accounting invariants without collecting, aggregating, or persisting any visitor financial data.

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

## Public Demo Deployment Guide

### A. Railway (Backend Deployment)

The backend runs as a containerized FastAPI application with an attached persistent volume for SQLite storage.

1. **Create Project:** On [Railway](https://railway.app), create a new project and connect the `debashis-sharingan-21/usually` GitHub repository.
2. **Configure Build:**
   - **Root Directory:** `/` (repo root) or `/backend`
   - **Dockerfile Path:** `backend/Dockerfile`
3. **Attach Persistent Storage Volume:**
   - Add a Volume to the backend service.
   - Set the mount path to: `/data`
   - *This ensures the synthetic demo SQLite database (`/data/usually_demo.db`) persists across deployments.*
4. **Environment Variables:**
   - `USUALLY_DEPLOYMENT_MODE`: `public_demo`
   - `USUALLY_DEMO_DB_PATH`: `/data/usually_demo.db`
   - `USUALLY_ALLOWED_ORIGINS`: `https://your-app.vercel.app` (your Vercel frontend URL)
   - `PORT`: `8000` (Railway automatically assigns the external port)
5. **Healthcheck Endpoint:**
   - Healthcheck Path: `/health`
   - Returns: `{"status": "ok", "deployment_mode": "public_demo", "database": "connected"}`

---

### B. Vercel (Frontend Deployment)

The Next.js App Router frontend deploys to Vercel and forwards `/api/*` requests to the Railway backend.

1. **Import Project:** On [Vercel](https://vercel.com), import the `debashis-sharingan-21/usually` repository.
2. **Configure Framework & Directory:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
3. **Environment Variables:**
   - `USUALLY_API_URL`: Your Railway backend domain (e.g. `https://usually-production.up.railway.app`)
   - `NEXT_PUBLIC_USUALLY_PUBLIC_DEMO`: `true`
4. **Deploy:** Click **Deploy**. Vercel will build the frontend with Turbopack and proxy all `/api/*` traffic cleanly to your Railway backend.
5. **Redeploy Reminder:** If you update the Railway backend URL, update `USUALLY_API_URL` in Vercel Project Settings and trigger a redeploy.

---

## SQLite Constraints & Single-Instance Architecture

- **Single Process Constraint:** SQLite is an embedded database that operates via local file locks (`WAL` mode). In cloud deployments like Railway, run **1 replica** of the backend service to prevent split-brain database locks.
- **Backups:** Because the persistent volume is mounted at `/data`, snapshot backups can be taken directly from the Railway volume dashboard.

---

## Automated Test Suite

Usually maintains a test suite of **73 automated regression tests** covering accounting logic, CSV parsing, habit detection, database isolation, and public demo security.

```bash
# Run the entire test suite:
pytest backend/tests/ -v
```

### Key Test Suites:
- `test_public_demo.py` (12 tests): Demonstrates server-side read-only enforcement, public demo context pinning, personal database prohibition, idempotent synthetic seeding, and HTTP 403 rejection of all mutations.
- `test_financial_invariants.py` (16 tests): Validates mathematical purity, non-negative amounts, authoritative balance identity, and delimiter resilience.
- `test_database_isolation.py`: Guarantees physical segregation between demo and personal SQLite files.
- `test_csv_importer.py` & `test_phonepe_2026_parsing.py`: Verifies resilient parsing across standard CSV, TSV, semicolon, and PhonePe statement structures.
- `test_habits.py` & `test_notifications_endpoint.py`: Validates evidence-backed observation generation and 30-day recency windows.

---

## License

MIT License. Built for Hacktoberfest 2026.
