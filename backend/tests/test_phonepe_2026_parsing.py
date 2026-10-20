import pytest
import sqlite3
from pathlib import Path
from app.services.csv_importer import (
    parse_and_preview_csv,
    execute_import,
    extract_rows_and_headers
)

PHONEPE_2026_DOWNLOAD_PATH = Path(r"C:\Users\HP\Downloads\PhonePe_Transaction_Statement (1).csv")

def get_test_db():
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
            direction TEXT NOT NULL DEFAULT 'debit',
            type TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            fingerprint TEXT UNIQUE NOT NULL,
            is_user_modified INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            ref_id TEXT
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

def test_synthetic_phonepe_2026_format_crlf_tabs_preamble_and_footers():
    """
    Tests handling of the PhonePe 2026 statement structure:
    - 3 introductory lines before column-header row
    - Blank line after statement metadata
    - Comma-delimited header with 8 columns
    - CRLF line endings (\\r\\n)
    - Tab whitespace preceding time values (\\t11:20)
    - 4 trailing informational footer lines
    - Zero 'bad delimiter value' exceptions
    - Footers cleanly separated as ignored footer metadata (not broken/error rows)
    """
    synthetic_phonepe_crlf = (
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

    preview = parse_and_preview_csv(synthetic_phonepe_crlf)

    # Must find header and parse without delimiter exception
    assert preview["headers"] == [
        "Date", "Time", "Transaction Details", "Transaction ID",
        "UTR", "Transaction Type", "Credit/debit instrument", "Amount"
    ]
    # 5 transaction rows, 0 broken rows, 4 footers safely filtered, 1 blank line skipped
    assert preview["total_rows"] == 5
    assert preview["valid_count"] == 5
    assert preview["error_count"] == 0
    assert preview["ambiguous_count"] == 0
    assert preview["ignored_footer_rows"] == 4
    assert preview["blank_rows_skipped"] == 1
    assert preview["is_confident"] is True
    assert preview["detected_date_range"] == ("2026-04-01", "2026-04-05")

    # Verify column auto-mapping
    mapping = preview["suggested_mapping"]
    assert mapping["date"] == "Date"
    assert mapping["description"] == "Transaction Details"
    assert mapping["amount"] == "Amount"
    assert mapping["type"] == "Transaction Type"
    assert mapping["ref_id"] == "Transaction ID"

    # Test in-memory DB import
    conn = get_test_db()
    result = execute_import(conn, "b_synth_2026", "synth_phonepe_2026.csv", synthetic_phonepe_crlf, mapping)
    assert result["total_rows"] == 5
    assert result["accepted_rows"] == 5
    assert result["rejected_rows"] == 0
    assert result["duplicate_rows"] == 0
    assert result["ignored_footer_rows"] == 4
    assert result["blank_rows_skipped"] == 1
    assert len(result["errors"]) == 0

    # Verify debit vs credit flows
    # Outflows: 15 + 50 + 340.50 = 405.50
    # Inflows: 200 (p2p) + 120 (refund) = 320.00
    assert result["gross_debit_outflow"] == 405.50
    assert result["gross_credit_inflow"] == 320.00
    assert result["classified_expenses"] == 405.50
    assert result["refunds_inflow"] == 120.00
    assert result["p2p_incoming"] == 200.00
    assert result["net_spending"] == 285.50  # 405.50 expenses - 120.00 refund

    # Verify rows in database
    cur = conn.cursor()
    cur.execute("SELECT date, clean_merchant, amount, direction, type FROM transactions ORDER BY id ASC")
    db_rows = cur.fetchall()
    assert len(db_rows) == 5

    # Local Tea Shop: debit, expense
    assert db_rows[0][1] == "Local Tea Shop"
    assert db_rows[0][3] == "debit"
    assert db_rows[0][4] == "expense"

    # Rohan Sharma: credit, p2p
    assert db_rows[2][1] == "Rohan Sharma"
    assert db_rows[2][3] == "credit"
    assert db_rows[2][4] == "p2p"

    # Swiggy: debit, expense
    assert db_rows[3][1] == "Swiggy"
    assert db_rows[3][3] == "debit"
    assert db_rows[3][4] == "expense"

    # Refund: credit, refund
    assert db_rows[4][3] == "credit"
    assert db_rows[4][4] == "refund"

    # Re-import test: 100% duplicate prevention
    re_result = execute_import(conn, "b_synth_dup", "synth_phonepe_2026.csv", synthetic_phonepe_crlf, mapping)
    assert re_result["total_rows"] == 5
    assert re_result["accepted_rows"] == 0
    assert re_result["duplicate_rows"] == 5
    assert re_result["rejected_rows"] == 0
    assert re_result["ignored_footer_rows"] == 4

def test_tsv_format_detection_and_parsing():
    """
    Verifies that tab-separated statements parse cleanly without bad delimiter errors.
    """
    tsv_content = (
        "Date\tDescription\tAmount\tType\n"
        "2026-10-01\tBlue Tokai Coffee\t260.00\tDebit\n"
        "2026-10-02\tSalary Deposit\t75000.00\tCredit\n"
    )
    headers, rows, meta, blank = extract_rows_and_headers(tsv_content)
    assert headers == ["Date", "Description", "Amount", "Type"]
    assert len(rows) == 2
    assert rows[0] == ["2026-10-01", "Blue Tokai Coffee", "260.00", "Debit"]

    preview = parse_and_preview_csv(tsv_content)
    assert preview["valid_count"] == 2
    assert preview["error_count"] == 0
    assert preview["is_confident"] is True

def test_semicolon_format_detection_and_parsing():
    """
    Verifies that semicolon-delimited CSV statements parse cleanly.
    """
    semi_content = (
        "Date;Narration;Amount;Type\n"
        "2026-10-05;Groceries Supermarket;1250.00;Debit\n"
        "2026-10-06;Cashback Received;50.00;Credit\n"
    )
    headers, rows, meta, blank = extract_rows_and_headers(semi_content)
    assert headers == ["Date", "Narration", "Amount", "Type"]
    assert len(rows) == 2

    preview = parse_and_preview_csv(semi_content)
    assert preview["valid_count"] == 2
    assert preview["error_count"] == 0
    assert preview["is_confident"] is True

def test_actual_local_phonepe_2026_file_if_available():
    """
    Tests against the actual local PhonePe (1) statement downloaded today:
    - 590 valid transactions
    - 0 errors
    - 4 footer notice rows
    - Date range: 2026-04-01 to 2026-10-16
    - Does NOT mutate or touch backend/data/usually.db!
    """
    if not PHONEPE_2026_DOWNLOAD_PATH.exists():
        pytest.skip(f"Actual file {PHONEPE_2026_DOWNLOAD_PATH} not found on local disk")

    with open(PHONEPE_2026_DOWNLOAD_PATH, "rb") as f:
        raw_bytes = f.read()

    content = raw_bytes.decode("utf-8", errors="replace")
    preview = parse_and_preview_csv(content)

    assert preview["headers"] == [
        "Date", "Time", "Transaction Details", "Transaction ID",
        "UTR", "Transaction Type", "Credit/debit instrument", "Amount"
    ]
    assert preview["total_rows"] == 590
    assert preview["valid_count"] == 590
    assert preview["error_count"] == 0
    assert preview["ambiguous_count"] == 0
    assert preview["ignored_footer_rows"] == 4
    assert preview["blank_rows_skipped"] == 1
    assert preview["is_confident"] is True
    assert preview["detected_date_range"] == ("2026-04-01", "2026-10-16")

    # Verify in-memory isolated import
    conn = get_test_db()
    mapping = preview["suggested_mapping"]
    import_res = execute_import(conn, "batch_phonepe_2026_actual", "PhonePe_Transaction_Statement (1).csv", content, mapping)

    assert import_res["total_rows"] == 590
    assert import_res["accepted_rows"] == 590
    assert import_res["rejected_rows"] == 0
    assert import_res["duplicate_rows"] == 0
    assert import_res["ignored_footer_rows"] == 4
    assert import_res["blank_rows_skipped"] == 1
    assert len(import_res["errors"]) == 0

    # Verify debit vs credit totals on actual file
    assert import_res["gross_debit_outflow"] == 129637.45
    assert import_res["gross_credit_inflow"] == 103939.48

    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM transactions WHERE direction = 'debit'")
    assert cur.fetchone()[0] == 449

    cur.execute("SELECT COUNT(*) FROM transactions WHERE direction = 'credit'")
    assert cur.fetchone()[0] == 141

    # In-memory re-import duplicate suppression
    re_res = execute_import(conn, "batch_phonepe_2026_dup", "PhonePe_Transaction_Statement (1).csv", content, mapping)
    assert re_res["total_rows"] == 590
    assert re_res["accepted_rows"] == 0
    assert re_res["duplicate_rows"] == 590
    assert re_res["rejected_rows"] == 0
    assert re_res["ignored_footer_rows"] == 4
