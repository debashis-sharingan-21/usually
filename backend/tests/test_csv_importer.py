import pytest
import sqlite3
from app.services.csv_importer import (
    parse_date_safely,
    parse_amount_str,
    detect_column_headers,
    generate_fingerprint,
    parse_and_preview_csv,
    execute_import
)

def test_parse_date_formats():
    assert parse_date_safely("2026-10-15") == "2026-10-15"
    assert parse_date_safely("15/10/2026") == "2026-10-15"
    assert parse_date_safely("15-10-2026") == "2026-10-15"
    assert parse_date_safely("15-Oct-2026") == "2026-10-15"
    assert parse_date_safely("2026-10-15T14:30:00") == "2026-10-15"
    assert parse_date_safely("invalid-date-string") is None
    assert parse_date_safely("") is None

def test_parse_amount_formats():
    # Regular positive number
    res = parse_amount_str("450.50")
    assert res == (450.50, False)

    # Number with currency symbol and commas
    res = parse_amount_str("₹1,250.75")
    assert res == (1250.75, False)

    # Parentheses negative
    res = parse_amount_str("(350.00)")
    assert res == (350.00, True)

    # Minus sign negative
    res = parse_amount_str("-99.00")
    assert res == (99.00, True)

    # CR / DR suffixes
    res_cr = parse_amount_str("500.00 CR")
    assert res_cr == (500.00, False)

    # Zero or invalid
    assert parse_amount_str("abc") is None
    assert parse_amount_str("") is None

def test_detect_column_headers():
    headers_1 = ["Transaction Date", "Narration", "Withdrawal Amount", "Deposit Amount", "Chq / Ref No"]
    mapping_1 = detect_column_headers(headers_1)
    assert mapping_1["date"] == "Transaction Date"
    assert mapping_1["description"] == "Narration"
    assert mapping_1["debit"] == "Withdrawal Amount"
    assert mapping_1["credit"] == "Deposit Amount"
    assert mapping_1["ref_id"] == "Chq / Ref No"

    headers_2 = ["Date", "Description", "Amount", "Type"]
    mapping_2 = detect_column_headers(headers_2)
    assert mapping_2["date"] == "Date"
    assert mapping_2["description"] == "Description"
    assert mapping_2["amount"] == "Amount"
    assert mapping_2["type"] == "Type"

def test_csv_preview_and_validation():
    csv_data = """Date,Description,Amount,Type
2026-10-01,Starbucks Coffee,250.00,DR
2026-10-02,Salary Credit,85000.00,CR
2026-10-03,Swiggy Lunch,340.00,DR
invalid-date,Bad Row,50.00,DR
2026-10-04,Missing Amount,,DR
"""
    preview = parse_and_preview_csv(csv_data)
    assert preview["total_rows"] == 5
    assert preview["valid_count"] == 3
    assert preview["error_count"] == 2
    assert preview["sample_total_expenses"] == 590.00
    assert preview["preview_rows"][3]["status"] == "error"
    assert "Cannot parse date" in preview["preview_rows"][3]["error_message"]
    assert preview["preview_rows"][4]["status"] == "error"

def test_duplicate_fingerprint_preserves_legitimate_repeated_purchases():
    # Same day, same merchant, same amount: occurrence counter allows multiple purchases in same batch
    fp_1 = generate_fingerprint("2026-10-15", "Blue Tokai", 220.0, "expense", None, occurrence_counter=1)
    fp_2 = generate_fingerprint("2026-10-15", "Blue Tokai", 220.0, "expense", None, occurrence_counter=2)
    assert fp_1 != fp_2

    # But re-importing the same row generates the identical fingerprint
    fp_1_repeat = generate_fingerprint("2026-10-15", "Blue Tokai", 220.0, "expense", None, occurrence_counter=1)
    assert fp_1 == fp_1_repeat

def test_execute_import_with_sqlite():
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
    """)

    csv_data = """Date,Description,Debit,Credit
2026-10-10,UPI/SWIGGY/ORDER,450.00,
2026-10-10,UPI/SWIGGY/ORDER,450.00,
2026-10-11,REFUND SWIGGY WRONG ITEM,,450.00
2026-10-12,SALARY TECH CORP,,90000.00
"""
    mapping = {"date": "Date", "description": "Description", "debit": "Debit", "credit": "Credit"}
    res = execute_import(conn, "b1", "test.csv", csv_data, mapping)
    assert res["accepted_rows"] == 4
    assert res["duplicate_rows"] == 0
    assert res["rejected_rows"] == 0

    # Test re-importing the same CSV: all 4 rows should now be detected as duplicates
    res_duplicate = execute_import(conn, "b2", "test.csv", csv_data, mapping)
    assert res_duplicate["accepted_rows"] == 0
    assert res_duplicate["duplicate_rows"] == 4
