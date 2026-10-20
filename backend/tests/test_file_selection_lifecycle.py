import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, get_connection, set_active_context

@pytest.fixture
def clean_test_env(tmp_path, monkeypatch):
    p_path = str(tmp_path / "lifecycle_personal.db")
    d_path = str(tmp_path / "lifecycle_demo.db")
    monkeypatch.setenv("USUALLY_DB_PATH", p_path)
    monkeypatch.setenv("USUALLY_DEMO_DB_PATH", d_path)
    init_db()
    set_active_context("personal")
    return p_path, d_path

FIXTURE_A_CSV = (
    "Date,Description,Amount,Type\n"
    "2025-01-10,Alpha Coffee Roasters,111.00,Debit\n"
    "2025-01-11,Alpha Bookshop,222.00,Debit\n"
    "2025-01-12,Alpha Hardware,333.00,Debit\n"
)

FIXTURE_B_CSV = (
    "Date,Description,Amount,Type\n"
    "2026-06-01,Beta Supermarket,555.00,Debit\n"
    "2026-06-02,Beta Pharmacy,666.00,Debit\n"
    "2026-06-03,Beta Fuel Station,777.00,Debit\n"
    "2026-06-04,Beta Utilities,888.00,Debit\n"
    "2026-06-05,Beta Electronics,999.00,Debit\n"
)

MALFORMED_CSV = "This is not a CSV header at all with no date and no amount"

def test_file_selection_preview_and_import_lifecycle(clean_test_env):
    """
    Tests selecting fixture A, previewing A, then selecting fixture B,
    previewing B, and importing B.
    Verifies that ONLY B's transactions are inserted, and A is never imported.
    """
    client = TestClient(app)
    conn = get_connection("personal")

    # 1. Preview Fixture A
    resp_a = client.post(
        "/api/transactions/preview",
        files={"file": ("statement_alpha.csv", FIXTURE_A_CSV.encode("utf-8"), "text/csv")}
    )
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["filename"] == "statement_alpha.csv"
    assert data_a["valid_count"] == 3
    assert data_a["total_rows"] == 3
    merchants_a = [r["parsed_merchant"] for r in data_a["preview_rows"]]
    assert "Alpha Coffee Roasters" in merchants_a

    # Verify zero transactions exist in database after previewing A
    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0

    # 2. Select Fixture B (without refreshing database or restarting server)
    resp_b = client.post(
        "/api/transactions/preview",
        files={"file": ("statement_beta.csv", FIXTURE_B_CSV.encode("utf-8"), "text/csv")}
    )
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["filename"] == "statement_beta.csv"
    assert data_b["valid_count"] == 5
    assert data_b["total_rows"] == 5
    merchants_b = [r["parsed_merchant"] for r in data_b["preview_rows"]]
    assert "Beta Supermarket" in merchants_b
    assert "Alpha Coffee Roasters" not in merchants_b

    # 3. Confirm & Import Fixture B using B's mapping
    mapping_b = data_b["suggested_mapping"]
    import_b = client.post(
        "/api/transactions/import",
        files={"file": ("statement_beta.csv", FIXTURE_B_CSV.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(mapping_b), "currency": "INR"}
    )
    assert import_b.status_code == 200
    res_b = import_b.json()
    assert res_b["accepted_rows"] == 5
    assert res_b["duplicate_rows"] == 0
    assert res_b["total_rows"] == 5
    assert res_b["filename"] == "statement_beta.csv"

    # 4. Strict Database Verification:
    # ONLY Fixture B's transactions must exist in the database!
    db_rows = conn.execute("SELECT clean_merchant, amount, date FROM transactions ORDER BY date ASC").fetchall()
    assert len(db_rows) == 5

    persisted_merchants = [r[0] for r in db_rows]
    for b_merchant in ["Beta Supermarket", "Beta Pharmacy", "Beta Fuel Station", "Beta Utilities", "Beta Electronics"]:
        assert b_merchant in persisted_merchants

    # Strictly verify that NO Alpha transactions were imported
    for r in db_rows:
        assert "Alpha" not in r[0]
        assert r[1] in [555.0, 666.0, 777.0, 888.0, 999.0]
        assert r[1] not in [111.0, 222.0, 333.0]

    # 5. Re-importing Fixture B:
    # Verifies duplicate detection on the newly imported file
    reimport_b = client.post(
        "/api/transactions/import",
        files={"file": ("statement_beta.csv", FIXTURE_B_CSV.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(mapping_b), "currency": "INR"}
    )
    assert reimport_b.status_code == 200
    res_reimport = reimport_b.json()
    assert res_reimport["accepted_rows"] == 0
    assert res_reimport["duplicate_rows"] == 5

    # Persisted count remains strictly 5
    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 5
    conn.close()

def test_failed_preview_followed_by_successful_file_selection(clean_test_env):
    """
    Tests selecting an unparseable/corrupt file (preview failure),
    then selecting a valid file, ensuring the valid file succeeds cleanly
    and imports without interference from the earlier failure.
    """
    client = TestClient(app)
    conn = get_connection("personal")

    # Step 1: Failed preview with malformed file
    fail_resp = client.post(
        "/api/transactions/preview",
        files={"file": ("corrupt.csv", MALFORMED_CSV.encode("utf-8"), "text/csv")}
    )
    # Returns 400 or valid_count = 0
    if fail_resp.status_code == 200:
        assert fail_resp.json()["valid_count"] == 0

    # Step 2: Now select valid Fixture B
    ok_resp = client.post(
        "/api/transactions/preview",
        files={"file": ("statement_beta.csv", FIXTURE_B_CSV.encode("utf-8"), "text/csv")}
    )
    assert ok_resp.status_code == 200
    data_b = ok_resp.json()
    assert data_b["valid_count"] == 5

    # Step 3: Import Fixture B
    import_b = client.post(
        "/api/transactions/import",
        files={"file": ("statement_beta.csv", FIXTURE_B_CSV.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(data_b["suggested_mapping"]), "currency": "INR"}
    )
    assert import_b.status_code == 200
    assert import_b.json()["accepted_rows"] == 5

    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 5
    conn.close()

def test_similar_filenames_are_distinguished_by_content(clean_test_env):
    """
    Simulates PhonePe_Transaction_Statement.csv vs PhonePe_Transaction_Statement (1).csv
    by using identical prefix names but distinct content and row counts.
    Ensures filename prefix similarity never confounds content identity.
    """
    client = TestClient(app)
    conn = get_connection("personal")

    file_1_content = (
        "Date,Description,Amount,Type\n"
        "2024-07-10,First Statement Merchant,100.00,Debit\n"
        "2024-07-11,First Statement Merchant,200.00,Debit\n"
    )

    file_2_content = (
        "Date,Description,Amount,Type\n"
        "2026-08-01,Second Statement Merchant,500.00,Debit\n"
        "2026-08-02,Second Statement Merchant,600.00,Debit\n"
        "2026-08-03,Second Statement Merchant,700.00,Debit\n"
    )

    # 1. Preview File 1
    p1 = client.post(
        "/api/transactions/preview",
        files={"file": ("PhonePe_Transaction_Statement.csv", file_1_content.encode("utf-8"), "text/csv")}
    )
    assert p1.status_code == 200
    assert p1.json()["valid_count"] == 2

    # 2. Preview File 2 (Similar name with ' (1)')
    p2 = client.post(
        "/api/transactions/preview",
        files={"file": ("PhonePe_Transaction_Statement (1).csv", file_2_content.encode("utf-8"), "text/csv")}
    )
    assert p2.status_code == 200
    data_2 = p2.json()
    assert data_2["valid_count"] == 3
    assert data_2["preview_rows"][0]["parsed_merchant"] == "Second Statement Merchant"

    # 3. Import File 2
    i2 = client.post(
        "/api/transactions/import",
        files={"file": ("PhonePe_Transaction_Statement (1).csv", file_2_content.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(data_2["suggested_mapping"]), "currency": "INR"}
    )
    assert i2.status_code == 200
    assert i2.json()["accepted_rows"] == 3
    assert i2.json()["filename"] == "PhonePe_Transaction_Statement (1).csv"

    # Database has exactly 3 rows from File 2
    rows = conn.execute("SELECT clean_merchant, amount FROM transactions").fetchall()
    assert len(rows) == 3
    for r in rows:
        assert r[0] == "Second Statement Merchant"
    conn.close()
