import os
import pytest
import sqlite3
from pathlib import Path
from app.services.csv_importer import (
    parse_and_preview_csv,
    execute_import,
    extract_rows_and_headers
)
from app.services.habit_engine import detect_habits

PHONEPE_DOWNLOAD_PATH = Path(r"C:\Users\HP\Downloads\PhonePe_Transaction_Statement.csv")

def get_empty_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript("""
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
            type TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            fingerprint TEXT UNIQUE NOT NULL,
            is_user_modified INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE habit_feedback (
            habit_key TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            notes TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE user_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE learned_payees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payee_key TEXT UNIQUE NOT NULL,
            clean_name TEXT NOT NULL,
            category TEXT NOT NULL,
            transaction_type TEXT NOT NULL DEFAULT 'expense',
            notes TEXT,
            user_classified INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE payee_questions (
            id TEXT PRIMARY KEY,
            payee_key TEXT NOT NULL,
            payee_name TEXT NOT NULL,
            prompt TEXT NOT NULL,
            options_json TEXT NOT NULL,
            transaction_count INTEGER NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    """)
    return conn

def test_phonepe_metadata_header_and_incomplete_rows():
    """
    Tests handling PhonePe preamble metadata, tab-prefixed times,
    explicit Debit/Credit interpretation, and incomplete rows detection.
    """
    sample_phonepe_content = """Transaction Statement for +918260595272
Duration,01 Apr 2024 - 31 Mar 2025

Date,Time,Transaction Details,Transaction ID,UTR,Transaction Type,Credit/debit instrument,Amount
2024-07-10,\t19:07,Paid to Guru Prasad Mohapatra,T2407101907167456942663,455872056840,Debit,XXXXXXXXXX4382,10.00
2024-07-10,\t19:10,Paid to Guru Prasad Mohapatra,T2407101910189947541100,455849389722,Debit,XXXXXXXXXX4382,5.00
2024-07-10,\t19:12,Received from Guru Prasad Mohapatra,T2407101912005814961905,455834690803,Credit,XXXXXXXXXX4382,15.00
2024-07-13,\t13:56,Paid to SUKANTA DAS,T2407131355566764538104,419526721018,Debit,XXXXXXXXXX4382,68.00
2024-07-14,\t10:53,,T2407141053362563478029,419636856858,Debit,XXXXXXXXXX4382,6999.00
2024-07-17,\t14:12,Paid to Missing Amount,T2407171412283109513979,456564732200,Debit,XXXXXXXXXX4382,
This is an automatically generated statement. Customer(s) are requested to immediately notify PhonePe
Visit https://www.phonepe.com/terms-conditions/ for PhonePe Terms & Conditions
"""
    preview = parse_and_preview_csv(sample_phonepe_content)
    # Total rows: 6 data rows (footer discarded)
    assert preview["total_rows"] == 6
    assert preview["valid_count"] == 4
    # Row 5 (missing details) and Row 6 (missing amount) are incomplete records
    assert preview["error_count"] == 2

    conn = get_empty_db()
    result = execute_import(conn, "b1", "phonepe_test.csv", sample_phonepe_content, preview["suggested_mapping"])
    assert result["accepted_rows"] == 4
    assert result["rejected_rows"] == 2
    assert any("Incomplete record" in err["error"] for err in result["errors"])

    # Verify explicit Debit and Credit interpretation
    cur = conn.cursor()
    cur.execute("SELECT amount, type FROM transactions WHERE clean_merchant = 'Guru Prasad Mohapatra' ORDER BY id")
    rows = cur.fetchall()
    assert len(rows) == 3
    assert rows[0][0] == 10.0 and rows[0][1] == "expense" # Debit
    assert rows[1][0] == 5.0 and rows[1][1] == "expense"  # Debit
    assert rows[2][0] == 15.0 and rows[2][1] == "p2p"     # Credit from person

    # Verify repeated payments preserved on same day
    assert rows[0][0] == 10.0 and rows[1][0] == 5.0

    # Test re-importing the same CSV: duplicate prevention
    result_dup = execute_import(conn, "b2", "phonepe_test.csv", sample_phonepe_content, preview["suggested_mapping"])
    assert result_dup["accepted_rows"] == 0
    assert result_dup["duplicate_rows"] == 4

def test_actual_downloaded_phonepe_export():
    """
    Tests against the actual PhonePe statement file if present locally.
    Reports exact count of valid, incomplete, rejected, and duplicate rows.
    """
    if not PHONEPE_DOWNLOAD_PATH.exists():
        pytest.skip(f"Actual file {PHONEPE_DOWNLOAD_PATH} not found, skipping local file test")

    with open(PHONEPE_DOWNLOAD_PATH, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    preview = parse_and_preview_csv(content)
    assert preview["total_rows"] == 467
    assert preview["valid_count"] == 467
    assert preview["error_count"] == 0
    assert preview["is_confident"] is True

    mapping = preview["suggested_mapping"]
    assert mapping["date"] == "Date"
    assert mapping["description"] == "Transaction Details"
    assert mapping["amount"] == "Amount"
    assert mapping["type"] == "Transaction Type"
    assert mapping["ref_id"] == "Transaction ID"

    conn = get_empty_db()
    import_res = execute_import(conn, "batch_phonepe_actual", "PhonePe_Transaction_Statement.csv", content, mapping)
    assert import_res["accepted_rows"] == 467
    assert import_res["rejected_rows"] == 0
    assert import_res["duplicate_rows"] == 0

    # Verify date range
    cur = conn.cursor()
    cur.execute("SELECT MIN(date), MAX(date) FROM transactions")
    min_d, max_d = cur.fetchone()
    assert min_d == "2024-07-10"
    assert max_d == "2025-03-31"

    # Verify debit vs credit totals
    cur.execute("SELECT COUNT(*), SUM(amount) FROM transactions WHERE type = 'expense'")
    debit_cnt, debit_tot = cur.fetchone()
    assert debit_cnt == 305
    assert round(debit_tot, 2) == 75880.89

    cur.execute("SELECT COUNT(*), SUM(amount) FROM transactions WHERE type IN ('income', 'p2p')")
    credit_cnt, credit_tot = cur.fetchone()
    assert credit_cnt == 162
    assert round(credit_tot, 2) == 86071.89

    # Re-import to verify exact duplicate suppression
    reimport_res = execute_import(conn, "batch_phonepe_dup", "PhonePe_Transaction_Statement.csv", content, mapping)
    assert reimport_res["accepted_rows"] == 0
    assert reimport_res["duplicate_rows"] == 467
