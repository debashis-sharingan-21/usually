import sqlite3
from pathlib import Path
from app.services.csv_importer import (
    detect_column_headers,
    parse_and_preview_csv,
    execute_import
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"

def test_real_anonymized_bank_export():
    csv_file = FIXTURES_DIR / "anonymized_bank_export.csv"
    assert csv_file.exists(), "Anonymized real export fixture must exist"

    with open(csv_file, "r", encoding="utf-8") as f:
        csv_content = f.read()

    # 1. Preview and header auto-detection
    preview = parse_and_preview_csv(csv_content)
    assert preview["total_rows"] == 10
    assert preview["valid_count"] == 10
    assert preview["error_count"] == 0

    mapping = preview["suggested_mapping"]
    assert mapping["date"] == "Txn Date"
    assert mapping["description"] == "Narration / Description"
    assert mapping["debit"] == "Withdrawal (Dr)"
    assert mapping["credit"] == "Deposit (Cr)"
    assert mapping["ref_id"] == "Reference No"

    # 2. Database import & deduplication test
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

    # Initial import: all 10 accepted
    result1 = execute_import(conn, "batch_real_1", "anonymized_bank_export.csv", csv_content, mapping)
    assert result1["accepted_rows"] == 10
    assert result1["duplicate_rows"] == 0
    assert result1["rejected_rows"] == 0

    # Verify extracted merchant names
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT clean_merchant FROM transactions ORDER BY clean_merchant")
    merchants = {r[0] for r in cur.fetchall()}
    assert "Swiggy" in merchants
    assert "Blue Tokai" in merchants
    assert "Amazon" in merchants
    assert "Uber" in merchants
    assert "Netflix" in merchants
    assert "Salary" in merchants

    # Verify both transactions on 2026-10-14 for Swiggy (different references) were accepted
    cur.execute("SELECT COUNT(*) FROM transactions WHERE date = '2026-10-14' AND clean_merchant = 'Swiggy'")
    assert cur.fetchone()[0] == 2

    # Second import of same file: all 10 must be recognized as duplicates
    result2 = execute_import(conn, "batch_real_2", "anonymized_bank_export.csv", csv_content, mapping)
    assert result2["accepted_rows"] == 0
    assert result2["duplicate_rows"] == 10
