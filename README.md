# Usually — Your Money Has Habits

> A polished, local-first, open-source AI personal finance companion for **Hacktoberfest 2026 Week 3**, themed **“Slow and Steady.”**

Usually is **not** a generic expense tracker or a chatbot that offers financial advice. It learns recurring patterns from a user's transaction history and produces short, witty, personalized observations grounded strictly in verified evidence.

---

## Intended Voice & Examples

- *“Wednesday again. You've ordered from Swiggy on 4 of your last 5 Wednesdays. No order yet today. Cooking tonight, buddy?”*
- *“Amazon has appeared in 5 of your last 6 months. A quiet month so far. Are we healing, or is Prime Day still loading?”*
- *“Your restaurant spending is 42% higher than your usual pace this month. Something worth celebrating?”*

> **Critical Rule:** Usually never displays an observation unless the imported data strictly supports it. Financial numbers are never hallucinated, invented, or calculated by AI.

---

## Architectural Principles & Privacy Guarantee

- **Local-first Persistence:** Stored locally in a local SQLite database (`backend/data/usually.db`).
- **Zero Cloud Transmit:** Raw CSV statements, parsed rows, and SHA-256 fingerprints never leave your machine.
- **Deterministic Accounting:** Income, expenses, category allocations, and monthly pacing benchmarks are calculated in tested Python code. Transfers (e.g., credit card bill payoffs, self-account transfers) are identified and excluded so they do not falsely inflate consumption spending.
- **Defensible Fingerprinting:** Prevents duplicate statement re-imports while preserving legitimate repeated purchases on the same day.
- **Local Open-Weight AI (Ollama + Gemma):**
  - If a local Ollama instance running `gemma2:2b` is active, it receives only minimal verified facts to produce a witty headline and message.
  - A claim validator checks generated text against evidence. If any number or date is not in the evidence, or if Ollama is offline, Usually falls back to tested deterministic templates with zero downtime.

---

## Project Structure

```
usually/
├── backend/
│   ├── app/
│   │   ├── config.py              # Configuration & settings
│   │   ├── database.py            # SQLite connection with WAL mode
│   │   ├── main.py                # FastAPI app entrypoint
│   │   ├── models/
│   │   │   └── schema.py          # Pydantic data schemas
│   │   ├── routes/
│   │   │   ├── transactions.py    # CSV preview, mapping, commit, edit, delete
│   │   │   ├── habits.py          # Discovered habit memory & user feedback
│   │   │   ├── learning.py        # Contextual payee questions & persistent rules
│   │   │   └── system.py          # Health, summary accounting, tone preference, demo data
│   │   └── services/
│   │       ├── csv_importer.py    # Deterministic CSV parser, confidence scoring, PhonePe support
│   │       ├── accounting.py      # Spending totals, pace, merchants
│   │       ├── habit_engine.py    # Longitudinal habit pattern detection & tone styling
│   │       ├── learning_engine.py # One-tap clarification & retroactive re-tagging
│   │       ├── ai_generator.py    # Ollama integration + fallback template engine
│   │       └── demo_data.py       # Realistic 6-month synthetic dataset
│   ├── fixtures/
│   │   └── anonymized_bank_export.csv  # Anonymized real-world export fixture
│   ├── tests/
│   │   ├── test_csv_importer.py
│   │   ├── test_accounting.py
│   │   ├── test_habits.py
│   │   ├── test_ai_fallback.py
│   │   ├── test_real_anonymized_export.py
│   │   ├── test_persistent_learning.py
│   │   ├── test_phonepe_export.py
│   │   └── test_successive_imports.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # Typed API client
│   │   ├── components/
│   │   │   ├── Navbar.tsx         # Top bar with health, privacy, and tone selector
│   │   │   ├── CSVImportModal.tsx # Drag & drop CSV import & confidence mapper
│   │   │   ├── NotificationFeed.tsx # Hero habit notification cards
│   │   │   ├── HabitMemoryView.tsx  # Longitudinal habit memory view
│   │   │   ├── PayeeQuestionsBanner.tsx # One-tap payee clarification cards
│   │   │   ├── SpendingSummary.tsx  # Spending pace, merchants, categories
│   │   │   └── TransactionList.tsx  # Searchable & editable transactions
│   │   ├── types/index.ts         # TypeScript definitions
│   │   ├── App.tsx                # App shell & onboarding state
│   │   └── index.css              # Dark-mode styling with lime accents
│   └── package.json
├── scripts/
│   ├── start-backend.ps1
│   ├── start-frontend.ps1
│   └── run-tests.ps1
└── README.md
```

---

## Quickstart & Running the Project

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Node.js 18+ (tested on Node v24)
- (Optional) [Ollama](https://ollama.com) running `gemma2:2b`

### 1. Setup and Run the Backend

```powershell
# From the project root (D:\usually):
.\backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# Start backend server:
.\scripts\start-backend.ps1
# Or directly:
$env:PYTHONPATH = "backend"
.\backend\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI backend will start at `http://127.0.0.1:8000` with interactive Swagger docs at `http://127.0.0.1:8000/docs`.

### 2. Setup and Run the Frontend

```powershell
# In another terminal:
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## Automated Test Suite

Run the full suite of unit and integration tests:

```powershell
.\scripts\run-tests.ps1
# Or:
.\backend\venv\Scripts\pytest.exe backend\tests -v
```

### Verified Test Results (20/20 passing):
- `test_accounting.py`: Verifies deterministic totals, transfer exclusion from consumption expenses, refunds, and cash flow.
- `test_csv_importer.py`: Tests date formats (`YYYY-MM-DD`, `DD/MM/YYYY`, `DD-Mon-YYYY`, ISO), amounts (commas, parentheses negatives, CR/DR), and duplicate fingerprinting.
- `test_habits.py`: Enforces minimum evidence thresholds (sparse history suppresses habits; multi-week patterns trigger reliably; user muting suppresses alerts).
- `test_ai_fallback.py`: Tests offline fallback to deterministic templates, and verifies that the claim validator strictly rejects hallucinated numbers.
- `test_real_anonymized_export.py`: Validates against real anonymized bank statement formats (`Txn Date`, `Narration / Description`, `Withdrawal (Dr)`, `Deposit (Cr)`).
- `test_persistent_learning.py`: Verifies one-tap clarification question generation, persistent rule storage, retroactive transaction re-tagging, and inheritance on future imports.
- `test_phonepe_export.py`: Validates PhonePe statement structure (metadata preamble, tab-prefixed times, explicit Debit/Credit direction, incomplete record reporting, duplicate suppression, and tests against 467-row export).
- `test_successive_imports.py`: Validates multi-month habit evolution and pacing shifts across successive overlapping statement imports without duplicate contamination.

---

## Demo Script

1. **Launch App:** Open `http://localhost:5173`. You will see the dark-mode editorial onboarding screen.
2. **Explore with Demo Data:** Click **&ldquo;Explore with 6-Month Demo Data&rdquo;** (or **&ldquo;Try Demo Data&rdquo;** in the navbar).
   - This seeds 95 realistic transactions spanning May to October 2026.
3. **Inspect the Habit Feed:**
   - Notice the Swiggy observation: *&ldquo;Wednesday again. You've ordered from Swiggy on 4 of your last 5 Wednesdays...&rdquo;*
   - Notice the Amazon observation: *&ldquo;Amazon has appeared in 5 of your last 6 months. A quiet month so far...&rdquo;*
   - Notice the Food & Dining pace shift observation.
4. **Inspect Evidence:** Click **&ldquo;Inspect Supporting Evidence&rdquo;** on any card to view the exact dates, counts, and privacy disclosure.
5. **Test Habit Control:** Click **&ldquo;Confirm&rdquo;** or **&ldquo;Mute&rdquo;**. Muted habits are instantly suppressed from the feed.
6. **Test CSV Import:** Click **&ldquo;Import CSV&rdquo;** in the navbar.
   - Drag and drop `backend/fixtures/anonymized_bank_export.csv`.
   - Observe automatic column mapping, row-by-row status preview, and date range detection.
   - Click **&ldquo;Confirm & Import&rdquo;**.
7. **Privacy Control:** Click **&ldquo;Clear&rdquo;** in the navbar to permanently purge all transactions and habit records from your local machine.

---

## Local AI Setup (Optional)

If you would like to test with Gemma running locally:
1. Install [Ollama](https://ollama.com).
2. Pull the Gemma model:
   ```bash
   ollama pull gemma2:2b
   ```
3. Start the Ollama server:
   ```bash
   ollama serve
   ```
Usually will automatically detect the running instance on `http://127.0.0.1:11434` and update the status pill in the navbar. If Ollama is offline or not installed, Usually operates seamlessly with its deterministic template engine.

---

## Near-Zero-Effort Import & Persistent Learning

1. **Automatic Header & Preamble Detection:**
   - Real-world exports (such as UPI/PhonePe statements) frequently include multi-line metadata preambles (e.g. `Transaction Statement for +91...`, date range rows) and disclaimer footers.
   - Usually's parser detects and skips non-tabular preamble lines, locates the real column headers, and discards footer notices automatically.

2. **Smart Column Recognition & Confidence:**
   - Scans candidate columns with regex patterns and checks sample cell formats (ISO dates, Indian dates `DD/MM/YYYY`, explicit Debit/Credit strings, numerical amounts).
   - If confidence $\ge 85\%$, it enables **One-Click Instant Import** without forcing manual mapping.

3. **Contextual One-Tap Payee Learning:**
   - When recurring payments to a counterparty are detected without an obvious commercial category, Usually generates a dismissible, one-tap question (e.g. *“I noticed several payments to Ramu. What kind of payments are these?”* with choices like *Friend or family*, *Rent or household*, *Transfer between accounts*).
   - Once answered, the classification is saved to SQLite (`learned_payees`), immediately retroactively tags past transactions, and automatically applies to all future statement imports.

4. **Real PhonePe Export Test Suite:**
   - Tested against an actual 467-row PhonePe statement export (`Date`, `Time`, `Transaction Details`, `Transaction ID`, `UTR`, `Transaction Type`, `Credit/debit instrument`, `Amount`).
   - Handles tab-prefixed timestamps (`\t19:07`), explicit `Debit`/`Credit` transaction types, and detects incomplete rows.
   - Full test outcome: **467 total records processed, 467 valid accepted (305 debits totaling ₹75,880.89, 162 credits totaling ₹86,071.89), 0 rejected, 0 duplicates on initial batch, 467 duplicate rejections on immediate re-import.**

---

## Known Limitations

- **Bank Format Diversity:** While tested against standard CSV exports and UPI statement formats, exotic bank exports (such as multi-header PDFs converted to CSV with merged cells) require manual column mapping.
- **Category Nuances:** Initial categorization relies on pattern heuristics; users can update or correct categories directly in the **Transactions** tab.
