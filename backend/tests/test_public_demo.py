import pytest
import sqlite3
import os
from fastapi.testclient import TestClient
from app.main import app
from app.database import (
    init_db,
    get_connection,
    get_active_context,
    set_active_context,
    get_db_path
)
from app.config import is_public_demo, get_personal_db_path, get_demo_db_path

@pytest.fixture
def public_demo_env(tmp_path, monkeypatch):
    """
    Sets up an isolated environment with:
    - USUALLY_DEPLOYMENT_MODE = 'public_demo'
    - An isolated synthetic demo DB path
    - An isolated personal DB path (which must never be touched)
    """
    demo_db = str(tmp_path / "public_demo.db")
    personal_db = str(tmp_path / "secret_personal.db")

    monkeypatch.setenv("USUALLY_DEPLOYMENT_MODE", "public_demo")
    monkeypatch.setenv("USUALLY_DEMO_DB_PATH", demo_db)
    monkeypatch.setenv("USUALLY_DB_PATH", personal_db)

    # Initialize the database under public_demo mode
    init_db()

    return {
        "demo_db": demo_db,
        "personal_db": personal_db,
        "client": TestClient(app)
    }

def test_1_public_demo_forces_reads_onto_demo_database(public_demo_env):
    """Demonstrate that all data-reading API requests are pinned to the demo database."""
    client = public_demo_env["client"]
    assert is_public_demo() is True
    assert get_active_context() == "demo"
    assert get_db_path("personal") == public_demo_env["demo_db"]

    # Health endpoint verifies active_context is demo
    res = client.get("/api/system/health")
    assert res.status_code == 200
    data = res.json()
    assert data["active_context"] == "demo"
    assert data["is_demo_mode"] is True
    assert data["deployment_mode"] == "public_demo"
    assert data["has_personal_data"] is False

def test_2_personal_database_not_initialized_or_modified(public_demo_env):
    """Demonstrate that the personal database file is never initialized, created, or opened."""
    client = public_demo_env["client"]
    personal_path = public_demo_env["personal_db"]

    # Trigger multiple reading requests
    client.get("/api/transactions")
    client.get("/api/accounting/summary")
    client.get("/api/notifications")
    client.get("/api/habits")
    client.get("/api/learning/questions")

    # Personal database path must not exist
    assert not os.path.exists(personal_path), "Personal database file was unexpectedly created!"

def test_3_database_context_cannot_be_changed(public_demo_env):
    """Demonstrate that switching to personal context is strictly forbidden in public_demo mode."""
    client = public_demo_env["client"]

    # Attempt switching via API
    res = client.post("/api/system/context", json={"context": "personal"})
    assert res.status_code == 403
    assert "Mutations are disabled in public demo mode" in res.json()["detail"]

    # Attempt direct function call
    with pytest.raises(ValueError):
        set_active_context("personal")

    assert get_active_context() == "demo"

def test_4_synthetic_demo_seeding_is_idempotent(public_demo_env):
    """Demonstrate that restarts/multiple init_db calls do not duplicate demo transactions."""
    demo_path = public_demo_env["demo_db"]
    conn = sqlite3.connect(demo_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM transactions")
    initial_count = cur.fetchone()[0]
    conn.close()

    assert initial_count > 0, "Demo database was not seeded on initialization!"

    # Simulate 3 server restarts / re-initializations
    init_db()
    init_db()
    init_db()

    conn = sqlite3.connect(demo_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM transactions")
    after_restarts_count = cur.fetchone()[0]
    conn.close()

    assert after_restarts_count == initial_count, "Seeding was not idempotent across restarts!"

def test_5_demo_summary_observations_and_transactions_work(public_demo_env):
    """Verify that public visitors can browse summary, observations, and transactions."""
    client = public_demo_env["client"]

    # 1. Summary
    res = client.get("/api/accounting/summary")
    assert res.status_code == 200
    summary = res.json()
    assert summary["transaction_count"] > 0
    assert summary["total_expenses"] > 0

    # 2. Transactions list
    res_tx = client.get("/api/transactions?limit=10")
    assert res_tx.status_code == 200
    tx_data = res_tx.json()
    assert len(tx_data["items"]) == 10
    assert tx_data["total"] > 0

    # 3. Notifications / Habits
    res_notif = client.get("/api/notifications")
    assert res_notif.status_code == 200
    assert isinstance(res_notif.json(), list)

def test_6_csv_preview_and_import_are_rejected(public_demo_env):
    """Demonstrate that CSV preview and CSV import are rejected with HTTP 403."""
    client = public_demo_env["client"]
    dummy_csv = "Date,Description,Amount\n2026-10-01,Test,100\n"

    # Preview rejection
    res_prev = client.post(
        "/api/transactions/preview",
        files={"file": ("test.csv", dummy_csv.encode("utf-8"), "text/csv")}
    )
    assert res_prev.status_code == 403
    assert "Mutations are disabled in public demo mode" in res_prev.json()["detail"]

    # Import rejection
    res_imp = client.post(
        "/api/transactions/import",
        files={"file": ("test.csv", dummy_csv.encode("utf-8"), "text/csv")},
        data={"mapping": "{}", "currency": "INR"}
    )
    assert res_imp.status_code == 403
    assert "Mutations are disabled in public demo mode" in res_imp.json()["detail"]

def test_7_transaction_mutation_and_deletion_rejected(public_demo_env):
    """Demonstrate that editing and deleting transactions return HTTP 403."""
    client = public_demo_env["client"]

    # Edit transaction
    res_edit = client.put(
        "/api/transactions/1",
        json={"clean_merchant": "Hacked Merchant", "category": "Shopping"}
    )
    assert res_edit.status_code == 403

    # Delete all transactions
    res_del = client.delete("/api/transactions")
    assert res_del.status_code == 403

def test_8_clear_data_and_reseed_endpoints_rejected(public_demo_env):
    """Demonstrate that clear-data and reseed endpoints return HTTP 403."""
    client = public_demo_env["client"]

    res_clear = client.post("/api/system/clear-data")
    assert res_clear.status_code == 403

    res_seed = client.post("/api/system/seed-demo")
    assert res_seed.status_code == 403

def test_9_habit_feedback_and_learning_mutations_rejected(public_demo_env):
    """Demonstrate that habit feedback and learning mutations return HTTP 403."""
    client = public_demo_env["client"]

    # Habit feedback mutation
    res_feed = client.post(
        "/api/habits/feedback",
        json={"habit_key": "some_habit", "status": "muted"}
    )
    assert res_feed.status_code == 403

    # Tone setting mutation
    res_tone = client.put("/api/system/tone", json={"tone": "minimal"})
    assert res_tone.status_code == 403

    # Learning question answer
    res_ans = client.post(
        "/api/learning/answer",
        json={"question_id": "q1", "selected_option_id": "opt1"}
    )
    assert res_ans.status_code == 403

    # Learning question dismissal
    res_dism = client.post("/api/learning/dismiss/q1")
    assert res_dism.status_code == 403

def test_10_local_development_mode_preserves_mutations(tmp_path, monkeypatch):
    """Demonstrate that normal local-development mode keeps CSV import, editing, and learning working."""
    p_path = str(tmp_path / "local_personal.db")
    d_path = str(tmp_path / "local_demo.db")

    # In local mode, USUALLY_DEPLOYMENT_MODE is not public_demo
    monkeypatch.setenv("USUALLY_DEPLOYMENT_MODE", "local")
    monkeypatch.setenv("USUALLY_DB_PATH", p_path)
    monkeypatch.setenv("USUALLY_DEMO_DB_PATH", d_path)

    init_db()
    set_active_context("personal")
    client = TestClient(app)

    # 1. Preview CSV succeeds in local mode
    csv_text = "Date,Description,Amount\n2026-10-01,Test Payee,250\n"
    res = client.post(
        "/api/transactions/preview",
        files={"file": ("statement.csv", csv_text.encode("utf-8"), "text/csv")}
    )
    assert res.status_code == 200

    # 2. Context switching succeeds in local mode
    res_ctx = client.post("/api/system/context", json={"context": "demo"})
    assert res_ctx.status_code == 200
    assert get_active_context() == "demo"

    # 3. Tone update succeeds in local mode
    res_tone = client.put("/api/system/tone", json={"tone": "dry"})
    assert res_tone.status_code == 200

def test_11_forbidden_requests_leave_demo_database_unmodified(public_demo_env):
    """Demonstrate that rejected mutation requests do not modify demo database rows."""
    client = public_demo_env["client"]
    demo_path = public_demo_env["demo_db"]

    conn = sqlite3.connect(demo_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM transactions")
    initial_tx = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM habit_feedback")
    initial_feedback = cur.fetchone()[0]
    conn.close()

    # Attempt multiple forbidden operations
    client.delete("/api/transactions")
    client.post("/api/system/clear-data")
    client.post("/api/habits/feedback", json={"habit_key": "swiggy", "status": "muted"})
    client.put("/api/transactions/1", json={"clean_merchant": "Tampered"})

    # Verify counts remain identical
    conn = sqlite3.connect(demo_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM transactions")
    assert cur.fetchone()[0] == initial_tx
    cur.execute("SELECT COUNT(*) FROM habit_feedback")
    assert cur.fetchone()[0] == initial_feedback
    conn.close()

def test_12_public_read_never_reveals_separate_personal_database(tmp_path, monkeypatch):
    """
    Demonstrate that even if a separate personal database exists on disk with specific data,
    public_demo requests can never access or leak that personal data.
    """
    demo_db = str(tmp_path / "public_demo.db")
    secret_personal_db = str(tmp_path / "secret_personal.db")

    # Deliberately populate the separate personal database with a canary transaction
    p_conn = sqlite3.connect(secret_personal_db)
    with p_conn:
        p_conn.executescript("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY, clean_merchant TEXT, amount REAL, category TEXT,
                raw_description TEXT, date TEXT, direction TEXT, type TEXT, currency TEXT,
                fingerprint TEXT UNIQUE, is_user_modified INTEGER, created_at TEXT
            );
            INSERT INTO transactions (id, clean_merchant, amount, category, raw_description, date, direction, type, currency, fingerprint, is_user_modified, created_at)
            VALUES (9999, 'TOP_SECRET_PERSONAL_PAYEE', 123456.0, 'Personal', 'SECRET RAW DESC', '2026-10-10', 'debit', 'expense', 'INR', 'secret_fp_123', 0, '2026-10-10');
        """)
    p_conn.close()

    # Switch to public_demo mode
    monkeypatch.setenv("USUALLY_DEPLOYMENT_MODE", "public_demo")
    monkeypatch.setenv("USUALLY_DEMO_DB_PATH", demo_db)
    monkeypatch.setenv("USUALLY_DB_PATH", secret_personal_db)

    init_db()
    client = TestClient(app)

    # Search transactions for the personal canary payee
    res = client.get("/api/transactions?search=TOP_SECRET_PERSONAL_PAYEE")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0

    # Verify summary does not include the 123456.0 amount
    res_sum = client.get("/api/accounting/summary")
    assert res_sum.status_code == 200
    summary = res_sum.json()
    for m in summary.get("top_merchants", []):
        assert "TOP_SECRET_PERSONAL_PAYEE" not in m.get("merchant", "")
