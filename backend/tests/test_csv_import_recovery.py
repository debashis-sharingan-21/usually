import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, get_connection, set_active_context

@pytest.fixture
def clean_test_dbs(tmp_path, monkeypatch):
    p_path = str(tmp_path / "recov_personal.db")
    d_path = str(tmp_path / "recov_demo.db")
    monkeypatch.setenv("USUALLY_DB_PATH", p_path)
    monkeypatch.setenv("USUALLY_DEMO_DB_PATH", d_path)
    init_db()
    set_active_context("personal")
    return p_path, d_path

def test_preview_does_not_mutate_database(clean_test_dbs):
    client = TestClient(app)
    conn = get_connection("personal")
    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0

    valid_csv = (
        "Date,Description,Amount,Type\n"
        "2026-10-01,Swiggy,450.00,Debit\n"
        "2026-10-02,Amazon,1200.00,Debit\n"
    )

    response = client.post(
        "/api/transactions/preview",
        files={"file": ("test_statement.csv", valid_csv.encode("utf-8"), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid_count"] == 2
    assert data["total_rows"] == 2
    assert data["filename"] == "test_statement.csv"

    # Database MUST NOT have any transactions written during preview
    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0
    conn.close()

def test_preview_empty_csv_returns_recoverable_response(clean_test_dbs):
    client = TestClient(app)
    response = client.post(
        "/api/transactions/preview",
        files={"file": ("empty.csv", b"", "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_rows"] == 0
    assert data["valid_count"] == 0
    assert data["needs_mapping"] is True

def test_preview_malformed_csv_returns_recoverable_status(clean_test_dbs):
    client = TestClient(app)
    malformed_csv = b"\x00\x01\x02\xff\xfe random binary garbage that is not a csv"
    response = client.post(
        "/api/transactions/preview",
        files={"file": ("corrupt.csv", malformed_csv, "text/csv")}
    )
    # Returns 200 with 0 valid rows or a clean 400 - both must be recoverable by the frontend
    assert response.status_code in [200, 400]
    if response.status_code == 200:
        data = response.json()
        assert data["valid_count"] == 0

def test_import_after_preview_end_to_end(clean_test_dbs):
    client = TestClient(app)
    conn = get_connection("personal")

    csv_content = (
        "Date,Description,Amount,Type\n"
        "2026-10-10,Swiggy,500.00,Debit\n"
        "2026-10-11,Salary,50000.00,Credit\n"
    )

    # Step 1: Preview
    p_resp = client.post(
        "/api/transactions/preview",
        files={"file": ("statement.csv", csv_content.encode("utf-8"), "text/csv")}
    )
    assert p_resp.status_code == 200
    mapping = p_resp.json()["suggested_mapping"]

    # Step 2: Import
    i_resp = client.post(
        "/api/transactions/import",
        files={"file": ("statement.csv", csv_content.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(mapping), "currency": "INR"}
    )
    assert i_resp.status_code == 200
    result = i_resp.json()
    assert result["accepted_rows"] == 2
    assert result["total_rows"] == 2

    # Verify rows in DB
    rows = conn.execute("SELECT clean_merchant, amount, direction, type FROM transactions ORDER BY id").fetchall()
    assert len(rows) == 2
    assert rows[0][0] == "Swiggy" and rows[0][1] == 500.0 and rows[0][2] == "debit"
    assert rows[1][0] == "Salary" and rows[1][1] == 50000.0 and rows[1][2] == "credit"

    # Step 3: Re-importing exact same statement: 0 duplicates created
    dup_resp = client.post(
        "/api/transactions/import",
        files={"file": ("statement.csv", csv_content.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(mapping), "currency": "INR"}
    )
    assert dup_resp.status_code == 200
    dup_result = dup_resp.json()
    assert dup_result["accepted_rows"] == 0
    assert dup_result["duplicate_rows"] == 2

    # Count remains 2
    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 2
    conn.close()

def test_phonepe_preview_and_import_recovery(clean_test_dbs):
    client = TestClient(app)
    phonepe_content = (
        "Transaction Statement for +918260595272\n"
        "Duration,01 Apr 2024 - 31 Mar 2025\n\n"
        "Date,Time,Transaction Details,Transaction ID,UTR,Transaction Type,Credit/debit instrument,Amount\n"
        "2024-07-10,\t19:07,Paid to Guru Prasad Mohapatra,T2407101907167456942663,455872056840,Debit,XXXXXXXXXX4382,10.00\n"
        "2024-07-10,\t19:12,Received from Guru Prasad Mohapatra,T2407101912005814961905,455834690803,Credit,XXXXXXXXXX4382,15.00\n"
        "This is an automatically generated statement.\n"
    )

    p_resp = client.post(
        "/api/transactions/preview",
        files={"file": ("phonepe.csv", phonepe_content.encode("utf-8"), "text/csv")}
    )
    assert p_resp.status_code == 200
    data = p_resp.json()
    assert data["valid_count"] == 2
    assert data["error_count"] == 1  # Footer notice correctly marked incomplete/error

    mapping = data["suggested_mapping"]
    i_resp = client.post(
        "/api/transactions/import",
        files={"file": ("phonepe.csv", phonepe_content.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(mapping), "currency": "INR"}
    )
    assert i_resp.status_code == 200
    i_data = i_resp.json()
    assert i_data["accepted_rows"] == 2
    assert i_data["rejected_rows"] == 1
