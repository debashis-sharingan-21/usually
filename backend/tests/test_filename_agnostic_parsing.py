import json
import pytest
import sqlite3
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, get_connection, set_active_context
from app.services.csv_importer import parse_and_preview_csv, execute_import

@pytest.fixture
def clean_isolated_dbs(tmp_path, monkeypatch):
    p_path = str(tmp_path / "filename_personal.db")
    d_path = str(tmp_path / "filename_demo.db")
    monkeypatch.setenv("USUALLY_DB_PATH", p_path)
    monkeypatch.setenv("USUALLY_DEMO_DB_PATH", d_path)
    init_db()
    set_active_context("personal")
    return p_path, d_path

SYNTHETIC_PHONEPE_2026_CSV = (
    "Transaction Statement for +919876543210\r\n"
    "Duration,01 Apr 2026 - 16 Oct 2026\r\n"
    "\r\n"
    "Date,Time,Transaction Details,Transaction ID,UTR,Transaction Type,Credit/debit instrument,Amount\r\n"
    "2026-04-01,\t11:20,Paid to Local Tea Shop,AC22260401112002574044143,158655077755,Debit,UPI,15.00\r\n"
    "2026-04-01,\t12:51,Paid to Fresh Juice Corner,T2604011251318021115740,652033878198,Debit,UPI,50.00\r\n"
    "2026-04-02,\t15:30,Received from Rohan Sharma,T2604021530221948572019,652099182736,Credit,UPI,200.00\r\n"
    "2026-04-03,\t18:45,Paid to Swiggy,AC22260403184512903847581,781920394857,Debit,UPI,340.50\r\n"
    "2026-04-05,\t09:15,Merchant Refund,T2604050915332819405829,891029384756,Credit,UPI,120.00\r\n"
    "\r\n"
    "This is an automatically generated statement. Customer(s) are requested to immediately notify PhonePe\r\n"
    "Visit https://www.phonepe.com/terms-conditions/ for PhonePe Terms & Conditions\r\n"
    "\"Do not fall prey to fictitious offers of winning prizes, money circulation schemes\"\r\n"
    "\"The contents of this email and document are confidential and intended for the recipient\"\r\n"
)

TEST_FILENAMES = [
    "PhonePe_Transaction_Statement (1).csv",
    "HELLO.csv",
    "PhonePe_Transaction_Statement.csv",
    "statement.csv",
    "my_bank_export.csv",
    "CUSTOM_NAME_2026.csv",
]

def test_identical_content_produces_identical_preview_across_filenames(clean_isolated_dbs):
    """
    Proves that preview results are 100% content-driven and invariant to filename.
    Filename must not determine parser selection, column mapping, or error counts.
    """
    client = TestClient(app)

    reference_preview = None

    for fname in TEST_FILENAMES:
        response = client.post(
            "/api/transactions/preview",
            files={"file": (fname, SYNTHETIC_PHONEPE_2026_CSV.encode("utf-8"), "text/csv")}
        )
        assert response.status_code == 200, f"Preview failed for filename '{fname}'"
        data = response.json()

        # Filename field reflects the uploaded file for display metadata
        assert data["filename"] == fname

        # All parsing outcomes must be identical
        assert data["headers"] == [
            "Date", "Time", "Transaction Details", "Transaction ID",
            "UTR", "Transaction Type", "Credit/debit instrument", "Amount"
        ]
        assert data["total_rows"] == 5
        assert data["valid_count"] == 5
        assert data["error_count"] == 0
        assert data["ambiguous_count"] == 0
        assert data["ignored_footer_rows"] == 4
        assert data["blank_rows_skipped"] == 1
        assert data["is_confident"] is True
        assert data["needs_mapping"] is False
        assert data["detected_date_range"] == ["2026-04-01", "2026-04-05"]

        if reference_preview is None:
            reference_preview = data
        else:
            # Check deep equivalence across preview fields
            for key in [
                "headers", "suggested_mapping", "total_rows", "valid_count",
                "error_count", "ambiguous_count", "confidence_score", "is_confident",
                "needs_mapping", "detected_date_range", "sample_total_expenses",
                "blank_rows_skipped", "ignored_footer_rows"
            ]:
                assert data[key] == reference_preview[key], f"Mismatch in key '{key}' between '{fname}' and reference"

            # Check preview rows match exactly
            assert len(data["preview_rows"]) == len(reference_preview["preview_rows"])
            for idx in range(len(data["preview_rows"])):
                r1 = data["preview_rows"][idx]
                r2 = reference_preview["preview_rows"][idx]
                assert r1["parsed_date"] == r2["parsed_date"]
                assert r1["parsed_merchant"] == r2["parsed_merchant"]
                assert r1["parsed_amount"] == r2["parsed_amount"]
                assert r1["parsed_direction"] == r2["parsed_direction"]
                assert r1["parsed_type"] == r2["parsed_type"]
                assert r1["status"] == r2["status"]

def test_identical_content_produces_identical_import_metrics_across_filenames(clean_isolated_dbs):
    """
    Proves that database imports produce identical financial totals, directions,
    accepted rows, and 0 rejected rows regardless of filename.
    """
    mapping = {
        "date": "Date",
        "description": "Transaction Details",
        "amount": "Amount",
        "type": "Transaction Type",
        "ref_id": "Transaction ID"
    }

    results = []
    for fname in ["PhonePe_Transaction_Statement (1).csv", "HELLO.csv", "statement.csv"]:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        init_db_schema = """
            CREATE TABLE import_batches (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                imported_at TEXT NOT NULL,
                total_rows INTEGER NOT NULL,
                accepted_rows INTEGER NOT NULL,
                duplicate_rows INTEGER NOT NULL,
                rejected_rows INTEGER NOT NULL
            );
            CREATE TABLE transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_batch_id TEXT,
                date TEXT NOT NULL,
                raw_description TEXT NOT NULL,
                clean_merchant TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                direction TEXT NOT NULL DEFAULT 'debit',
                type TEXT NOT NULL,
                currency TEXT NOT NULL DEFAULT 'INR',
                fingerprint TEXT UNIQUE NOT NULL,
                is_user_modified INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                ref_id TEXT
            );
            CREATE TABLE habit_feedback (habit_key TEXT PRIMARY KEY, status TEXT NOT NULL, notes TEXT, updated_at TEXT NOT NULL);
            CREATE TABLE user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE learned_payees (id INTEGER PRIMARY KEY, payee_key TEXT, clean_name TEXT, category TEXT, transaction_type TEXT, notes TEXT, user_classified INTEGER, created_at TEXT, updated_at TEXT);
            CREATE TABLE payee_questions (id TEXT PRIMARY KEY, payee_key TEXT, payee_name TEXT, prompt TEXT, options_json TEXT, transaction_count INTEGER, total_amount REAL, status TEXT, created_at TEXT, updated_at TEXT);
        """
        conn.executescript(init_db_schema)

        res = execute_import(conn, f"batch_{fname[:4]}", fname, SYNTHETIC_PHONEPE_2026_CSV, mapping)
        results.append((fname, res))

        # Check transactions in DB
        cur = conn.cursor()
        cur.execute("SELECT direction, type, amount FROM transactions ORDER BY id ASC")
        rows = cur.fetchall()
        assert len(rows) == 5
        assert rows[0][0] == "debit" and rows[0][1] == "expense" and rows[0][2] == 15.0
        assert rows[1][0] == "debit" and rows[1][1] == "expense" and rows[1][2] == 50.0
        assert rows[2][0] == "credit" and rows[2][1] == "p2p" and rows[2][2] == 200.0
        assert rows[3][0] == "debit" and rows[3][1] == "expense" and rows[3][2] == 340.5
        assert rows[4][0] == "credit" and rows[4][1] == "refund" and rows[4][2] == 120.0
        conn.close()

    # Compare results across filenames
    ref_name, ref_res = results[0]
    for fn, res in results[1:]:
        assert res["total_rows"] == ref_res["total_rows"] == 5
        assert res["accepted_rows"] == ref_res["accepted_rows"] == 5
        assert res["rejected_rows"] == ref_res["rejected_rows"] == 0
        assert res["duplicate_rows"] == ref_res["duplicate_rows"] == 0
        assert res["ignored_footer_rows"] == ref_res["ignored_footer_rows"] == 4
        assert res["gross_debit_outflow"] == ref_res["gross_debit_outflow"] == 405.5
        assert res["gross_credit_inflow"] == ref_res["gross_credit_inflow"] == 320.0
        assert res["classified_expenses"] == ref_res["classified_expenses"] == 405.5
        assert res["net_spending"] == ref_res["net_spending"] == 285.5

def test_cross_filename_deduplication(clean_isolated_dbs):
    """
    Proves that importing a file named 'PhonePe_Transaction_Statement (1).csv' and
    re-importing the identical file named 'HELLO.csv' into the same database yields
    100% duplicate suppression (0 accepted, 5 duplicates, 0 rejected).
    """
    client = TestClient(app)
    mapping = {
        "date": "Date",
        "description": "Transaction Details",
        "amount": "Amount",
        "type": "Transaction Type",
        "ref_id": "Transaction ID"
    }

    # 1. Import with original filename
    res1 = client.post(
        "/api/transactions/import",
        files={"file": ("PhonePe_Transaction_Statement (1).csv", SYNTHETIC_PHONEPE_2026_CSV.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(mapping), "currency": "INR"}
    )
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["accepted_rows"] == 5
    assert d1["duplicate_rows"] == 0
    assert d1["rejected_rows"] == 0

    # 2. Re-import identical content under renamed filename 'HELLO.csv'
    res2 = client.post(
        "/api/transactions/import",
        files={"file": ("HELLO.csv", SYNTHETIC_PHONEPE_2026_CSV.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(mapping), "currency": "INR"}
    )
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["accepted_rows"] == 0
    assert d2["duplicate_rows"] == 5
    assert d2["rejected_rows"] == 0
    assert d2["ignored_footer_rows"] == 4

    # 3. Re-import under yet another filename 'statement.csv'
    res3 = client.post(
        "/api/transactions/import",
        files={"file": ("statement.csv", SYNTHETIC_PHONEPE_2026_CSV.encode("utf-8"), "text/csv")},
        data={"mapping": json.dumps(mapping), "currency": "INR"}
    )
    assert res3.status_code == 200
    d3 = res3.json()
    assert d3["accepted_rows"] == 0
    assert d3["duplicate_rows"] == 5
    assert d3["rejected_rows"] == 0

    # Verify total transactions in DB remains strictly 5
    conn = get_connection("personal")
    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 5
    conn.close()

def test_preview_never_mutates_database_regardless_of_filename(clean_isolated_dbs):
    """
    Verifies that preview endpoint never writes to the database, regardless of filename.
    """
    client = TestClient(app)
    conn = get_connection("personal")
    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0

    for fname in TEST_FILENAMES:
        res = client.post(
            "/api/transactions/preview",
            files={"file": (fname, SYNTHETIC_PHONEPE_2026_CSV.encode("utf-8"), "text/csv")}
        )
        assert res.status_code == 200
        assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 0

    conn.close()
