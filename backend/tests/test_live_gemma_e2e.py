import pytest
import sqlite3
import os
from unittest.mock import patch
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
from app.services.csv_importer import execute_import

@pytest.fixture
def isolated_synthetic_db():
    conn = sqlite3.connect(":memory:")
    conn.executescript(SCHEMA_SQL)
    migrate_db(conn)
    yield conn
    conn.close()

def is_real_gemma_available():
    # Allow explicit opt-out for automated CI or offline runs
    if os.environ.get("SKIP_LIVE_GEMMA", "").lower() in ("1", "true", "yes"):
        return False
    try:
        ok, model = check_ollama_status()
        return bool(ok and model == "gemma2:2b")
    except Exception:
        return False

# ---------------------------------------------------------------------------
# End-to-end Real Model Inference & Persistent Learning
# ---------------------------------------------------------------------------

@pytest.mark.live_gemma
@pytest.mark.skipif(not is_real_gemma_available(), reason="Local gemma2:2b Ollama instance not available")
def test_real_gemma_merchant_classification_application_path():
    merchant_name = "FreshGreen Organic Mart Whitefield"
    res = suggest_merchant_category_with_ai(merchant_name)

    assert res is not None
    assert res["suggested_category"] in VALID_CATEGORIES
    assert res["suggested_by"] == "ollama_gemma"
    assert res["confidence"] >= 0.5
    assert len(res["reason"]) > 5

@pytest.mark.live_gemma
@pytest.mark.skipif(not is_real_gemma_available(), reason="Local gemma2:2b Ollama instance not available")
def test_real_gemma_end_to_end_learning_cycle_and_zero_repeat(isolated_synthetic_db):
    db = isolated_synthetic_db
    batch_1 = "synth_batch_001"
    now_iso = "2026-10-15T10:00:00"

    # 1. First import with unfamiliar synthetic merchant
    with db:
        db.execute("""
            INSERT INTO transactions (import_batch_id, date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at)
            VALUES (?, '2026-10-14', 'UPI/P2M/QuickFix Plumbing Services', 'QuickFix Plumbing Services', 'General', 1850.0, 'debit', 'expense', 'INR', 'fp_qf1', 0, ?)
        """, (batch_1, now_iso))
        db.execute("""
            INSERT INTO transactions (import_batch_id, date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at)
            VALUES (?, '2026-10-15', 'UPI/P2M/QuickFix Plumbing Services', 'QuickFix Plumbing Services', 'General', 1200.0, 'debit', 'expense', 'INR', 'fp_qf2', 0, ?)
        """, (batch_1, now_iso))

    # Generate questions using real Gemma
    created = generate_payee_questions_for_batch(db, batch_1)
    assert created == 1

    pending = get_pending_questions(db)
    assert len(pending) == 1
    q = pending[0]
    assert q["status"] == "pending"
    assert q["suggested_by"] == "ollama_gemma"
    assert q["suggested_category"] in VALID_CATEGORIES
    suggested_cat = q["suggested_category"]

    # Verify transactions are not prematurely updated before review
    cur = db.cursor()
    cur.execute("SELECT category, is_user_modified FROM transactions WHERE clean_merchant = 'QuickFix Plumbing Services'")
    rows_before = cur.fetchall()
    assert all(r[0] == "General" and r[1] == 0 for r in rows_before)

    # 2. User approves suggestion
    answer_res = answer_payee_question(db, question_id=q["id"], selected_option_id="ai_suggestion")
    assert answer_res["status"] == "success"

    # Verify persistent memory in learned_payees
    cur.execute("SELECT payee_key, clean_name, category, user_classified, notes FROM learned_payees WHERE payee_key = 'quickfix plumbing services'")
    rule = cur.fetchone()
    assert rule is not None
    assert rule[0] == "quickfix plumbing services"
    assert rule[2] == suggested_cat
    assert rule[3] == 1
    assert "Gemma suggestion" in rule[4]

    # Verify retroactive update to existing transactions
    cur.execute("SELECT category, is_user_modified, amount, direction FROM transactions WHERE clean_merchant = 'QuickFix Plumbing Services'")
    rows_after = cur.fetchall()
    assert all(r[0] == suggested_cat and r[1] == 1 for r in rows_after)
    assert all(r[2] in (1850.0, 1200.0) for r in rows_after)

    # 3. Subsequent import of the same merchant (Verify ZERO repeat model calls)
    batch_2 = "synth_batch_002"
    csv_content = """Date,Description,Amount,Type
2026-10-21,Paid to QuickFix Plumbing Services,950.00,Debit
"""
    mapping = {"date": "Date", "description": "Description", "amount": "Amount", "type": "Type"}

    call_count = {"count": 0}
    orig_suggest = suggest_merchant_category_with_ai
    def counting_suggest(*args, **kwargs):
        call_count["count"] += 1
        return orig_suggest(*args, **kwargs)

    with patch("app.services.ai_generator.suggest_merchant_category_with_ai", side_effect=counting_suggest):
        res_import = execute_import(
            conn=db,
            batch_id=batch_2,
            filename="second_import.csv",
            csv_content=csv_content,
            mapping=mapping
        )

    # Model was NOT queried again
    assert call_count["count"] == 0
    assert res_import["pending_questions_count"] == 0

    # Second transaction was automatically categorized from learned rule
    cur.execute("SELECT category, is_user_modified, amount FROM transactions WHERE import_batch_id = ?", (batch_2,))
    second_row = cur.fetchone()
    assert second_row[0] == suggested_cat
    assert second_row[1] == 1
    assert second_row[2] == 950.0

@pytest.mark.live_gemma
@pytest.mark.skipif(not is_real_gemma_available(), reason="Local gemma2:2b Ollama instance not available")
def test_real_gemma_spending_pace_provenance():
    pace = {
        "month": "2026-10",
        "as_of_day": 15,
        "current_month_spend": 34200.0,
        "historical_baseline_pace": 28500.0,
        "diff_percentage": 20.0,
        "status": "higher"
    }
    explanation, gen_by = explain_spending_pace_with_ai(pace, tone="playful")
    assert gen_by == "ollama_gemma"
    assert len(explanation) > 10
    # Must preserve polarity (spending is higher, cannot say decreased/dropped)
    lowered = explanation.lower()
    assert "dropped by" not in lowered
    assert "decreased by" not in lowered
