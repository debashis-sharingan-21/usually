import pytest
import sqlite3
from app.database import SCHEMA_SQL
from app.services.csv_importer import execute_import
from app.services.accounting import calculate_spending_summary
from app.services.learning_engine import (
    generate_payee_questions_for_batch,
    get_pending_questions,
    answer_payee_question
)

def test_direction_preserved_and_isolated_from_p2p_classification():
    """
    Regression Test for Phase 2.2:
    Proves that debit/credit flow direction is invariant to payee classification.
    Paying a friend remains a DEBIT outflow (never counted as income).
    Receiving money from a friend remains a CREDIT inflow.
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)

    # Import statement with both outgoing debit and incoming credit for the same person (Ramu)
    csv_data = """Date,Transaction Details,Transaction Type,Amount
2026-10-01,Paid to Ramu Sharma,DEBIT,1500.00
2026-10-02,Received from Ramu Sharma,CREDIT,500.00
2026-10-03,Swiggy Bangalore,DEBIT,350.00
2026-10-04,Salary Tech Corp,CREDIT,50000.00
"""
    mapping = {
        "date": "Date",
        "description": "Transaction Details",
        "type": "Transaction Type",
        "amount": "Amount"
    }

    result = execute_import(conn, "batch_dir_test_1", "statement_1.csv", csv_data, mapping)
    assert result["accepted_rows"] == 4

    cur = conn.cursor()
    # Check initial directions and types
    cur.execute("SELECT raw_description, direction, type, amount FROM transactions ORDER BY date ASC")
    rows = cur.fetchall()

    # 1. Paid to Ramu: debit outflow
    assert rows[0]["direction"] == "debit"
    assert rows[0]["amount"] == 1500.0

    # 2. Received from Ramu: credit inflow
    assert rows[1]["direction"] == "credit"
    assert rows[1]["amount"] == 500.0

    # 3. Swiggy: debit expense
    assert rows[2]["direction"] == "debit"
    assert rows[2]["type"] == "expense"
    assert rows[2]["amount"] == 350.0

    # 4. Salary: credit income
    assert rows[3]["direction"] == "credit"
    assert rows[3]["type"] == "income"
    assert rows[3]["amount"] == 50000.0

    # Accounting before question answering:
    summary_before = calculate_spending_summary(conn)
    assert summary_before["total_p2p_incoming"] == 500.0
    assert summary_before["total_income"] == 50000.0
    assert summary_before["gross_credit_inflow"] == 50500.0
    assert summary_before["gross_debit_outflow"] == 1850.0  # 1500 + 350

    # Now, generate questions and answer Ramu Sharma as "Friend or family" (p2p)
    pending_qs = get_pending_questions(conn)
    ramu_q = next((q for q in pending_qs if "ramu" in q["payee_name"].lower()), None)
    assert ramu_q is not None

    answer_res = answer_payee_question(
        conn=conn,
        question_id=ramu_q["id"],
        selected_option_id="friend_family"
    )
    assert answer_res["status"] == "success"
    assert answer_res["transaction_type"] == "p2p"

    # Verify transactions after answering
    cur.execute("SELECT raw_description, direction, type, category, amount FROM transactions WHERE clean_merchant LIKE '%Ramu%' ORDER BY date ASC")
    ramu_txs = cur.fetchall()
    assert len(ramu_txs) == 2

    # CRITICAL CHECK: Neither transaction flipped direction!
    # Outgoing payment is STILL a debit
    assert ramu_txs[0]["direction"] == "debit"
    assert ramu_txs[0]["type"] == "p2p"
    assert ramu_txs[0]["category"] == "Personal & Peer"
    assert ramu_txs[0]["amount"] == 1500.0

    # Incoming payment is STILL a credit
    assert ramu_txs[1]["direction"] == "credit"
    assert ramu_txs[1]["type"] == "p2p"
    assert ramu_txs[1]["category"] == "Personal & Peer"
    assert ramu_txs[1]["amount"] == 500.0

    # Accounting after question answering:
    summary_after = calculate_spending_summary(conn)

    # 1. Money sent to Ramu (1500) MUST NOT be counted as income or p2p incoming!
    assert summary_after["total_p2p_incoming"] == 500.0
    assert summary_after["total_p2p_outgoing"] == 1500.0

    # 2. Consumer expenses exclude P2P and Transfers (only Swiggy = 350)
    assert summary_after["total_expenses"] == 350.0

    # 3. Gross Outflows and Inflows must be strictly preserved
    assert summary_after["gross_debit_outflow"] == 1850.0  # 1500 (Ramu debit) + 350 (Swiggy debit)
    assert summary_after["gross_credit_inflow"] == 50500.0 # 50000 (Salary credit) + 500 (Ramu credit)

    # 4. Successive statement import with learned rule preserves direction
    csv_data_month2 = """Date,Transaction Details,Transaction Type,Amount
2026-11-01,Paid to Ramu Sharma,DEBIT,700.00
2026-11-05,Received from Ramu Sharma,CREDIT,200.00
"""
    result_m2 = execute_import(conn, "batch_dir_test_2", "statement_2.csv", csv_data_month2, mapping)
    assert result_m2["accepted_rows"] == 2

    cur.execute("SELECT direction, type, amount FROM transactions WHERE import_batch_id = 'batch_dir_test_2' ORDER BY date ASC")
    m2_rows = cur.fetchall()
    # Learned rule applied 'p2p' type to both, but respected DEBIT and CREDIT from statement!
    assert m2_rows[0]["direction"] == "debit"
    assert m2_rows[0]["type"] == "p2p"
    assert m2_rows[0]["amount"] == 700.0

    assert m2_rows[1]["direction"] == "credit"
    assert m2_rows[1]["type"] == "p2p"
    assert m2_rows[1]["amount"] == 200.0

    conn.close()
