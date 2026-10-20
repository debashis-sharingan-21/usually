import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
import sqlite3

MAJOR_BRAND_EXCLUSIONS = {
    'swiggy', 'zomato', 'amazon', 'flipkart', 'myntra', 'uber', 'ola',
    'netflix', 'spotify', 'youtube', 'apple', 'starbucks', 'blue tokai',
    'mcdonald\'s', 'airtel', 'jio', 'bescom', 'electricity', 'cred payment',
    'salary', 'merchant refund', 'cult.fit', 'apollo pharmacy', 'blinkit', 'zepto'
}

DEFAULT_OPTIONS = [
    {
        "id": "friend_family",
        "label": "Friend or family",
        "category": "Personal & Peer",
        "transaction_type": "p2p",
        "description": "Money sent to friends, relatives, or personal contacts"
    },
    {
        "id": "rent_household",
        "label": "Rent or household",
        "category": "Housing & Rent",
        "transaction_type": "expense",
        "description": "Landlord, maintenance, society, or household staff"
    },
    {
        "id": "work_business",
        "label": "Work or business",
        "category": "Work & Business",
        "transaction_type": "expense",
        "description": "Contractors, vendors, or reimbursable work expenses"
    },
    {
        "id": "self_transfer",
        "label": "Transfer between my own accounts",
        "category": "Transfers",
        "transaction_type": "transfer",
        "description": "Moving money between savings, credit cards, or investments"
    },
    {
        "id": "services_groceries",
        "label": "Local services or groceries",
        "category": "Services & Groceries",
        "transaction_type": "expense",
        "description": "Neighborhood store, maid, laundry, or local services"
    },
    {
        "id": "not_sure",
        "label": "Not sure yet",
        "category": "General",
        "transaction_type": "expense",
        "description": "Keep as general expense for now"
    }
]

def generate_payee_questions_for_batch(conn: sqlite3.Connection, batch_id: str) -> int:
    """
    Examines newly imported transactions for recurring or high-value unclassified payees.
    Generates non-blocking, one-tap questions for payees without known brand rules or existing classifications.
    """
    cur = conn.cursor()

    known_learned_keys = set()
    existing_question_keys = set()
    try:
        cur.execute("SELECT payee_key FROM learned_payees")
        known_learned_keys = {r[0] for r in cur.fetchall()}
        cur.execute("SELECT payee_key FROM payee_questions")
        existing_question_keys = {r[0] for r in cur.fetchall()}
    except sqlite3.OperationalError:
        return 0

    cur.execute("""
        SELECT clean_merchant, COUNT(*) as cnt, SUM(amount) as tot, MIN(date) as min_d, MAX(date) as max_d
        FROM transactions
        WHERE import_batch_id = ?
        GROUP BY clean_merchant
        HAVING cnt >= 2 OR tot >= 1000
        ORDER BY tot DESC
        LIMIT 10
    """, (batch_id,))

    candidates = cur.fetchall()
    created_count = 0
    now_iso = datetime.now().isoformat()

    for row in candidates:
        merchant_name = row[0]
        cnt = row[1]
        tot = row[2]
        payee_key = merchant_name.strip().lower()

        if payee_key in MAJOR_BRAND_EXCLUSIONS or payee_key in known_learned_keys or payee_key in existing_question_keys:
            continue

        q_id = f"q_{uuid.uuid4().hex[:10]}"
        prompt = f"I noticed {cnt} payment{'s' if cnt > 1 else ''} to {merchant_name} totaling ₹{tot:,.0f}. What kind of payments are these?"

        cur.execute("""
            INSERT INTO payee_questions (id, payee_key, payee_name, prompt, options_json, transaction_count, total_amount, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        """, (q_id, payee_key, merchant_name, prompt, json.dumps(DEFAULT_OPTIONS), cnt, tot, now_iso, now_iso))

        existing_question_keys.add(payee_key)
        created_count += 1

    conn.commit()
    return created_count

def get_pending_questions(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, payee_key, payee_name, prompt, options_json, transaction_count, total_amount, status, created_at
            FROM payee_questions
            WHERE status = 'pending'
            ORDER BY total_amount DESC, transaction_count DESC
        """)
        rows = cur.fetchall()
        questions = []
        for r in rows:
            questions.append({
                "id": r[0],
                "payee_key": r[1],
                "payee_name": r[2],
                "prompt": r[3],
                "options": json.loads(r[4]),
                "transaction_count": r[5],
                "total_amount": round(r[6], 2),
                "status": r[7],
                "created_at": r[8],
            })
        return questions
    except sqlite3.OperationalError:
        return []

def answer_payee_question(
    conn: sqlite3.Connection,
    question_id: str,
    selected_option_id: str,
    custom_category: Optional[str] = None,
    custom_type: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute("SELECT payee_key, payee_name, options_json FROM payee_questions WHERE id = ?", (question_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Question with ID {question_id} not found")

    payee_key, payee_name, options_json = row
    options = json.loads(options_json)

    chosen = next((opt for opt in options if opt["id"] == selected_option_id), None)
    if not chosen and not custom_category:
        raise ValueError("Invalid option selected and no custom category provided")

    final_cat = custom_category or (chosen["category"] if chosen else "General")
    final_type = custom_type or (chosen["transaction_type"] if chosen else "expense")
    now_iso = datetime.now().isoformat()

    with conn:
        conn.execute("""
            UPDATE payee_questions
            SET status = 'answered', updated_at = ?
            WHERE id = ?
        """, (now_iso, question_id))

        conn.execute("""
            INSERT INTO learned_payees (payee_key, clean_name, category, transaction_type, notes, user_classified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(payee_key) DO UPDATE SET
                clean_name = excluded.clean_name,
                category = excluded.category,
                transaction_type = excluded.transaction_type,
                notes = excluded.notes,
                user_classified = 1,
                updated_at = excluded.updated_at
        """, (payee_key, payee_name, final_cat, final_type, notes, now_iso, now_iso))

        conn.execute("""
            UPDATE transactions
            SET category = ?, type = ?, is_user_modified = 1
            WHERE LOWER(clean_merchant) = ? OR LOWER(raw_description) LIKE ?
        """, (final_cat, final_type, payee_key, f"%{payee_key}%"))

    return {
        "status": "success",
        "question_id": question_id,
        "payee_key": payee_key,
        "clean_name": payee_name,
        "category": final_cat,
        "transaction_type": final_type,
    }

def dismiss_payee_question(conn: sqlite3.Connection, question_id: str) -> Dict[str, Any]:
    now_iso = datetime.now().isoformat()
    with conn:
        conn.execute("""
            UPDATE payee_questions
            SET status = 'dismissed', updated_at = ?
            WHERE id = ?
        """, (now_iso, question_id))
    return {"status": "dismissed", "question_id": question_id}

def list_learned_payees(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, payee_key, clean_name, category, transaction_type, notes, user_classified, created_at, updated_at
            FROM learned_payees
            ORDER BY updated_at DESC
        """)
        rows = cur.fetchall()
        return [{
            "id": r[0],
            "payee_key": r[1],
            "clean_name": r[2],
            "category": r[3],
            "transaction_type": r[4],
            "notes": r[5],
            "user_classified": bool(r[6]),
            "created_at": r[7],
            "updated_at": r[8],
        } for r in rows]
    except sqlite3.OperationalError:
        return []
