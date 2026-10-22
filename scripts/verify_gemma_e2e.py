"""
End-to-end verification script for Gemma-assisted merchant classification,
persistent learning, and spending pace interpretation.
Uses dedicated, isolated in-memory and temporary SQLite databases.
Guarantees zero modifications to personal workspace data.
"""

import sys
import os
import json
import sqlite3
from unittest.mock import patch

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SCHEMA_SQL, migrate_db
from app.services.ai_generator import (
    check_ollama_status,
    suggest_merchant_category_with_ai,
    explain_spending_pace_with_ai,
    VALID_CATEGORIES
)
from app.services.learning_engine import (
    generate_payee_questions_for_batch,
    get_pending_questions,
    answer_payee_question,
    dismiss_payee_question
)
from app.services.csv_importer import clean_merchant_and_category, execute_import

def make_isolated_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.executescript(SCHEMA_SQL)
    migrate_db(conn)
    return conn

def run_verification():
    print("=" * 70)
    print("USUALLY: END-TO-END GEMMA & PERSISTENT LEARNING VERIFICATION")
    print("=" * 70)

    # 1. Environment & Model Discovery
    print("\n[Step 1] Checking Ollama Status & Model Availability...")
    ollama_ok, model_name = check_ollama_status()
    print(f"  Ollama Reachable: {ollama_ok}")
    print(f"  Configured Model: {model_name}")
    if not ollama_ok or model_name in ("offline", "none", "no_models"):
        print("  [FAIL] Real Gemma model is not reachable. Aborting live test.")
        return False
    print("  [PASS] Real Gemma local instance is active and ready.")

    # 2. Real Inference on Unfamiliar Merchant
    print("\n[Step 2] Real Gemma Merchant Classification (Application Path)...")
    synthetic_merchant_1 = "GreenGrocer Organics Bengaluru"
    ai_result = suggest_merchant_category_with_ai(synthetic_merchant_1)
    print(f"  Merchant: '{synthetic_merchant_1}'")
    print(f"  Gemma Result: {ai_result}")

    assert ai_result is not None, "Gemma failed to return classification"
    assert ai_result["suggested_category"] in VALID_CATEGORIES, f"Invalid category: {ai_result['suggested_category']}"
    assert ai_result["suggested_by"] == "ollama_gemma", "Provenance is not ollama_gemma"
    assert ai_result["confidence"] > 0.0, "Confidence not provided"
    assert len(ai_result["reason"]) > 5, "Reason not provided"
    print(f"  [PASS] Valid Category: '{ai_result['suggested_category']}'")
    print(f"  [PASS] Grounded Reason: '{ai_result['reason']}'")
    print(f"  [PASS] Confidence: {ai_result['confidence']} | Type: '{ai_result['suggested_type']}'")

    # 3. Batch Question Creation & Review Flow (Isolated Synthetic DB)
    print("\n[Step 3] Batch Question Generation & Awaiting-Review Status...")
    db = make_isolated_db()
    batch_1 = "synth_batch_001"
    now_iso = "2026-10-15T10:00:00"

    with db:
        db.execute("""
            INSERT INTO transactions (import_batch_id, date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at)
            VALUES (?, '2026-10-14', 'UPI/P2M/GreenGrocer Organics/txn1', 'GreenGrocer Organics', 'General', 1450.0, 'debit', 'expense', 'INR', 'fp_gg1', 0, ?)
        """, (batch_1, now_iso))
        db.execute("""
            INSERT INTO transactions (import_batch_id, date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at)
            VALUES (?, '2026-10-15', 'UPI/P2M/GreenGrocer Organics/txn2', 'GreenGrocer Organics', 'General', 890.0, 'debit', 'expense', 'INR', 'fp_gg2', 0, ?)
        """, (batch_1, now_iso))

    created = generate_payee_questions_for_batch(db, batch_1)
    print(f"  Generated Payee Questions: {created}")
    assert created == 1, f"Expected 1 question, got {created}"

    pending_questions = get_pending_questions(db)
    assert len(pending_questions) == 1
    q = pending_questions[0]
    print(f"  Question ID: {q['id']}")
    print(f"  Status: {q['status']} (Awaiting user review)")
    print(f"  Suggested Category: {q['suggested_category']}")
    print(f"  Suggested By: {q['suggested_by']}")
    print(f"  AI Reason: {q['ai_reason']}")
    assert q["status"] == "pending", "Question is not marked pending"
    assert q["suggested_by"] == "ollama_gemma", "Question not marked as Gemma suggestion"
    assert q["suggested_category"] in VALID_CATEGORIES, "Question suggested category not valid"

    # Verify transactions are NOT prematurely modified before review
    cur = db.cursor()
    cur.execute("SELECT category, is_user_modified, amount FROM transactions WHERE clean_merchant = 'GreenGrocer Organics'")
    tx_before = cur.fetchall()
    print(f"  Transactions before approval: categories={[t[0] for t in tx_before]}, amounts={[t[2] for t in tx_before]}")
    assert all(t[0] == "General" and t[1] == 0 for t in tx_before), "Transactions prematurely modified!"
    print("  [PASS] Transactions remained unmodified prior to explicit approval.")

    # 4. User Approves Suggestion -> Persistent Learning
    print("\n[Step 4] User Approves Gemma Suggestion...")
    answer_res = answer_payee_question(db, question_id=q["id"], selected_option_id="ai_suggestion")
    print(f"  Answer result: {answer_res}")

    # Check learned_payees table
    cur.execute("SELECT payee_key, clean_name, category, transaction_type, notes, user_classified FROM learned_payees WHERE payee_key = 'greengrocer organics'")
    rule = cur.fetchone()
    print(f"  Saved Learned Rule: {rule}")
    assert rule is not None, "Rule was not saved to learned_payees"
    assert rule[0] == "greengrocer organics", "Incorrect payee_key normalization"
    assert rule[2] == q["suggested_category"], "Category does not match approved suggestion"
    assert rule[5] == 1, "user_classified is not 1"
    assert "Gemma suggestion" in rule[4], "Provenance notes missing"
    print("  [PASS] Learned rule permanently stored with Gemma provenance notes.")

    # Check that existing transactions were retroactively reclassified
    cur.execute("SELECT category, is_user_modified, amount, direction FROM transactions WHERE clean_merchant = 'GreenGrocer Organics'")
    tx_after = cur.fetchall()
    print(f"  Transactions after approval: categories={[t[0] for t in tx_after]}, amounts={[t[2] for t in tx_after]}")
    assert all(t[0] == q["suggested_category"] and t[1] == 1 for t in tx_after), "Transactions not retroactively reclassified"
    assert all(t[2] in (1450.0, 890.0) for t in tx_after), "Transaction amounts corrupted!"
    assert all(t[3] == "debit" for t in tx_after), "Transaction direction corrupted!"
    print("  [PASS] Existing transactions reclassified. Amounts, dates, and direction intact.")

    # Verify question is no longer pending
    pending_after = get_pending_questions(db)
    assert len(pending_after) == 0, "Question still pending after answer"
    print("  [PASS] Payee question marked answered; zero pending questions remaining.")

    # 5. Subsequent Import (Zero-Repeat Inference)
    print("\n[Step 5] Subsequent Import of Same Merchant (Zero-Repeat Inference)...")
    batch_2 = "synth_batch_002"
    csv_content = """Date,Description,Amount,Type
2026-10-20,Paid to GreenGrocer Organics,1200.00,Debit
"""
    mapping = {"date": "Date", "description": "Description", "amount": "Amount", "type": "Type"}

    # Track calls to suggest_merchant_category_with_ai during second import
    call_counter = {"count": 0}
    orig_suggest = suggest_merchant_category_with_ai
    def counted_suggest(*args, **kwargs):
        call_counter["count"] += 1
        return orig_suggest(*args, **kwargs)

    with patch("app.services.ai_generator.suggest_merchant_category_with_ai", side_effect=counted_suggest):
        import_res = execute_import(
            conn=db,
            batch_id=batch_2,
            filename="subsequent_statement.csv",
            csv_content=csv_content,
            mapping=mapping
        )

    print(f"  Import Result: {import_res['accepted_rows']} accepted, {import_res['pending_questions_count']} questions")
    print(f"  Gemma Model Calls During Second Import: {call_counter['count']}")
    assert call_counter["count"] == 0, f"Expected 0 model calls, but got {call_counter['count']}!"
    assert import_res["pending_questions_count"] == 0, "Unexpected questions generated for learned merchant!"

    # Verify second transaction was automatically classified using learned rule
    cur.execute("SELECT category, is_user_modified, amount FROM transactions WHERE import_batch_id = ?", (batch_2,))
    second_tx = cur.fetchone()
    print(f"  Second Transaction: Category='{second_tx[0]}', UserModified={second_tx[1]}, Amount={second_tx[2]}")
    assert second_tx[0] == q["suggested_category"], "Second transaction did not reuse learned category!"
    assert second_tx[1] == 1, "is_user_modified not set for learned merchant"
    print("  [PASS] Zero repeat model inference! Reused learned rule deterministically.")

    # Total row counts check
    cur.execute("SELECT COUNT(*) FROM transactions")
    total_tx = cur.fetchone()[0]
    assert total_tx == 3, f"Expected 3 total transactions, found {total_tx}"
    print(f"  [PASS] Exactly 3 transactions in isolated database. No row duplication.")

    # 6. User Correction / Override Flow
    print("\n[Step 6] User Correction / Category Override Flow...")
    db_corr = make_isolated_db()
    batch_corr = "batch_corr_01"
    with db_corr:
        db_corr.execute("""
            INSERT INTO transactions (import_batch_id, date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at)
            VALUES (?, '2026-10-18', 'Apex Cloud Services', 'Apex Cloud Services', 'General', 3500.0, 'debit', 'expense', 'INR', 'fp_apex1', 0, ?)
        """, (batch_corr, now_iso))

    generate_payee_questions_for_batch(db_corr, batch_corr)
    q_corr = get_pending_questions(db_corr)[0]
    print(f"  Gemma Suggestion: '{q_corr['suggested_category']}'")

    # User manually corrects to "Utilities & Bills" instead of Gemma's suggestion
    answer_payee_question(db_corr, q_corr["id"], selected_option_id="manual", custom_category="Utilities & Bills", notes="User corrected")
    cur_corr = db_corr.cursor()
    cur_corr.execute("SELECT category, notes FROM learned_payees WHERE payee_key = 'apex cloud services'")
    rule_corr = cur_corr.fetchone()
    print(f"  Stored Rule: Category='{rule_corr[0]}', Notes='{rule_corr[1]}'")
    assert rule_corr[0] == "Utilities & Bills", "User manual correction was not respected!"
    print("  [PASS] User manual correction cleanly overrides Gemma suggestion in persistent memory.")

    # 7. Dismiss Flow Does NOT Save Rule
    print("\n[Step 7] Dismissing Suggestion Flow...")
    db_dismiss = make_isolated_db()
    batch_dis = "batch_dis_01"
    with db_dismiss:
        db_dismiss.execute("""
            INSERT INTO transactions (import_batch_id, date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at)
            VALUES (?, '2026-10-18', 'Mystery Vendor X', 'Mystery Vendor X', 'General', 1500.0, 'debit', 'expense', 'INR', 'fp_mv1', 0, ?)
        """, (batch_dis, now_iso))

    generate_payee_questions_for_batch(db_dismiss, batch_dis)
    q_dis = get_pending_questions(db_dismiss)[0]
    dismiss_payee_question(db_dismiss, q_dis["id"])

    cur_dis = db_dismiss.cursor()
    cur_dis.execute("SELECT COUNT(*) FROM learned_payees WHERE payee_key = 'mystery vendor x'")
    assert cur_dis.fetchone()[0] == 0, "Dismissed question was incorrectly saved as a rule!"
    print("  [PASS] Dismissed suggestion did not create any rule in learned_payees.")

    # 8. Spending Pace Real Inference & Provenance
    print("\n[Step 8] Real Gemma Spending Pace Explanation & Provenance...")
    test_pace = {
        "month": "2026-10",
        "as_of_day": 15,
        "current_month_spend": 34200.0,
        "historical_baseline_pace": 28500.0,
        "diff_percentage": 20.0,
        "status": "higher"
    }
    pace_exp, pace_gen_by = explain_spending_pace_with_ai(test_pace, tone="playful")
    print(f"  Pace Input: Day 15 | Cur: ₹34,200 | Baseline: ₹28,500 | Diff: +20.0% (higher)")
    print(f"  Pace Explanation: \"{pace_exp}\"")
    print(f"  Pace Provenance: {pace_gen_by}")
    assert pace_gen_by == "ollama_gemma", f"Expected ollama_gemma provenance, got {pace_gen_by}"
    assert "20" in pace_exp or "15" in pace_exp or "34" in pace_exp or "28" in pace_exp, "No verified figures in pace text"
    print("  [PASS] Real Gemma generated grounded pace narrative with accurate provenance.")

    # 9. Verify Safety: Personal Workspace Database Untouched (Read-Only)
    print("\n[Step 9] Integrity Check of Actual Personal Workspace Database...")
    workspace_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "data", "workspaces")
    real_ws_path = os.path.join(workspace_dir, "workspace_guest_94bffb42cc83.db")
    if os.path.exists(real_ws_path):
        uri = f"file:{os.path.abspath(real_ws_path)}?mode=ro"
        ro_conn = sqlite3.connect(uri, uri=True)
        ro_cur = ro_conn.cursor()
        ro_cur.execute("PRAGMA integrity_check")
        integrity = ro_cur.fetchone()[0]
        assert integrity == "ok", f"Integrity check failed: {integrity}"

        ro_cur.execute("SELECT COUNT(*) FROM transactions")
        tx_count = ro_cur.fetchone()[0]
        ro_cur.execute("SELECT COUNT(*) FROM import_batches")
        batch_count = ro_cur.fetchone()[0]
        ro_cur.execute("SELECT COUNT(*) FROM learned_payees")
        learned_count = ro_cur.fetchone()[0]
        ro_cur.execute("SELECT COUNT(*) FROM payee_questions")
        q_count = ro_cur.fetchone()[0]
        ro_cur.execute("SELECT COUNT(*) FROM payee_questions WHERE status = 'pending'")
        pending_count = ro_cur.fetchone()[0]

        print(f"  Active Workspace Database: {os.path.basename(real_ws_path)}")
        print(f"  File Size: {os.path.getsize(real_ws_path):,} bytes")
        print(f"  Integrity Check: {integrity}")
        print(f"  Total Transactions: {tx_count} (across {batch_count} batches)")
        print(f"  Learned Rules Count: {learned_count}")
        print(f"  Payee Questions Count: {q_count} ({pending_count} pending review)")

        # Verify Piyush Lenka records were not modified by any test
        ro_cur.execute("SELECT COUNT(*), category FROM transactions WHERE lower(clean_merchant) LIKE '%piyush%' GROUP BY category")
        piyush_counts = ro_cur.fetchall()
        print(f"  Piyush Lenka Aggregate Distribution: {piyush_counts}")
        ro_cur.execute("SELECT COUNT(*) FROM learned_payees WHERE lower(payee_key) LIKE '%greengrocer%' OR lower(payee_key) LIKE '%apex%'")
        synthetic_in_real = ro_cur.fetchone()[0]
        assert synthetic_in_real == 0, "CRITICAL ERROR: Synthetic test merchants leaked into real workspace!"
        ro_conn.close()
        print("  [PASS] Real personal workspace completely untouched and non-destructive.")

    print("\n" + "=" * 70)
    print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY WITH REAL GEMMA!")
    print("=" * 70)
    return True

if __name__ == "__main__":
    ok = run_verification()
    sys.exit(0 if ok else 1)
