import pytest
import sqlite3
import os
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, get_connection, get_active_context, set_active_context, get_db_path
from app.services.demo_data import load_realistic_demo_dataset

@pytest.fixture
def isolated_dbs(tmp_path, monkeypatch):
    p_path = str(tmp_path / "isolation_personal.db")
    d_path = str(tmp_path / "isolation_demo.db")
    monkeypatch.setenv("USUALLY_DB_PATH", p_path)
    monkeypatch.setenv("USUALLY_DEMO_DB_PATH", d_path)
    init_db()
    set_active_context("personal")
    return p_path, d_path

def test_demo_and_personal_contexts_use_separate_databases(isolated_dbs):
    p_path, d_path = isolated_dbs
    assert p_path != d_path

    # Initially both are empty
    p_conn = get_connection("personal")
    d_conn = get_connection("demo")

    assert p_conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0
    assert d_conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0

    # Seed demo data into demo context
    load_realistic_demo_dataset(d_conn)
    assert d_conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 82

    # Personal DB must remain completely empty (zero contamination)
    assert p_conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0

    # Insert a personal transaction into personal context
    with p_conn:
        p_conn.execute("""
            INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, type, currency, fingerprint, created_at)
            VALUES ('2025-01-15', 'Grocery Store Purchase', 'Local Mart', 'Groceries', 450.0, 'expense', 'INR', 'fp_pers_1', '2025-01-15T10:00:00')
        """)

    assert p_conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 1
    # Demo context remains unchanged at 82
    assert d_conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 82

    # Clear demo data
    with d_conn:
        d_conn.execute("DELETE FROM transactions")
        d_conn.execute("DELETE FROM import_batches")

    assert d_conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0
    # Personal transaction is strictly preserved!
    assert p_conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 1

    p_conn.close()
    d_conn.close()

def test_import_switches_context_and_preserves_isolation(isolated_dbs):
    client = TestClient(app)

    # 1. Seed demo data via API
    res = client.post("/api/system/seed-demo")
    assert res.status_code == 200
    assert res.json()["active_context"] == "demo"

    # Health check reflects demo context
    h_demo = client.get("/api/system/health").json()
    assert h_demo["is_demo_mode"] is True
    assert h_demo["transaction_count"] == 82
    assert h_demo["active_context"] == "demo"

    # Notifications in demo mode show synthetic demo habits
    n_demo = client.get("/api/notifications").json()
    demo_merchants = [n["merchant"] for n in n_demo if n["merchant"]]
    assert any(m in ("Swiggy", "Amazon", "Blue Tokai", "Toit") for m in demo_merchants)

    # 2. Import a real statement CSV
    sample_csv = """Date,Details,Amount,Type
2025-02-01,Electricity Board BESCOM,1250.00,Debit
2025-02-05,Office Cafeteria Lunch,120.00,Debit
2025-02-10,Salary Deposit,75000.00,Credit
"""
    files = {"file": ("bank_stmt.csv", sample_csv, "text/csv")}
    data = {
        "mapping": '{"date": "Date", "description": "Details", "amount": "Amount", "type": "Type"}',
        "currency": "INR"
    }

    import_res = client.post("/api/transactions/import", files=files, data=data)
    assert import_res.status_code == 200
    res_json = import_res.json()
    assert res_json["accepted_rows"] == 3
    assert res_json["gross_debit_outflow"] == 1370.0
    assert res_json["gross_credit_inflow"] == 75000.0
    assert res_json["classified_expenses"] == 1370.0
    assert res_json["total_spent"] == 1370.0

    # 3. Importing automatically switched active context to personal!
    h_pers = client.get("/api/system/health").json()
    assert h_pers["is_demo_mode"] is False
    assert h_pers["active_context"] == "personal"
    assert h_pers["transaction_count"] == 3
    assert h_pers["has_personal_data"] is True

    # Personal notifications never contain synthetic demo merchants
    n_pers = client.get("/api/notifications").json()
    pers_merchants = [n["merchant"] for n in n_pers if n["merchant"]]
    assert not any(m in ("Swiggy", "Blue Tokai", "Toit") for m in pers_merchants)

    # 4. Switch back to demo mode without losing personal data
    client.post("/api/system/context", json={"context": "demo"})
    h_back_demo = client.get("/api/system/health").json()
    assert h_back_demo["is_demo_mode"] is True
    assert h_back_demo["transaction_count"] == 82
    assert h_back_demo["has_personal_data"] is True

    # 5. Switch back to personal mode
    client.post("/api/system/context", json={"context": "personal"})
    h_back_pers = client.get("/api/system/health").json()
    assert h_back_pers["is_demo_mode"] is False
    assert h_back_pers["transaction_count"] == 3
