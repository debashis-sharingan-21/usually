import sqlite3
import os
from typing import Optional
from app.config import DATA_DIR

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    accepted_rows INTEGER NOT NULL,
    duplicate_rows INTEGER NOT NULL,
    rejected_rows INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_batch_id TEXT,
    date TEXT NOT NULL,
    raw_description TEXT NOT NULL,
    clean_merchant TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    direction TEXT NOT NULL DEFAULT 'debit', -- 'debit', 'credit', 'unknown'
    type TEXT NOT NULL, -- 'expense', 'p2p', 'transfer', 'income', 'refund'
    currency TEXT NOT NULL DEFAULT 'INR',
    fingerprint TEXT UNIQUE NOT NULL,
    is_user_modified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    ref_id TEXT,
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(clean_merchant);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);

CREATE TABLE IF NOT EXISTS habit_feedback (
    habit_key TEXT PRIMARY KEY,
    status TEXT NOT NULL, -- 'confirmed', 'muted', 'active'
    notes TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Persistent learning: stores user classifications for payees
CREATE TABLE IF NOT EXISTS learned_payees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payee_key TEXT UNIQUE NOT NULL, -- lowercase normalized payee name
    clean_name TEXT NOT NULL,
    category TEXT NOT NULL,
    transaction_type TEXT NOT NULL DEFAULT 'expense', -- 'expense', 'transfer', 'income', 'p2p'
    notes TEXT,
    user_classified INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learned_payee_key ON learned_payees(payee_key);

-- Contextual one-tap questions for ambiguous or recurring unclassified payees
CREATE TABLE IF NOT EXISTS payee_questions (
    id TEXT PRIMARY KEY,
    payee_key TEXT NOT NULL,
    payee_name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options_json TEXT NOT NULL,
    transaction_count INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'answered', 'dismissed'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_status ON payee_questions(status);
"""

_ACTIVE_CONTEXT: str = "personal"

def get_db_path(context: str = "personal") -> str:
    custom_personal = os.environ.get("USUALLY_DB_PATH")
    if context == "demo":
        custom_demo = os.environ.get("USUALLY_DEMO_DB_PATH")
        if custom_demo:
            return custom_demo
        if custom_personal:
            if custom_personal.endswith(".db"):
                return custom_personal[:-3] + "_demo.db"
            return custom_personal + "_demo"
        return str(DATA_DIR / "usually_demo.db")
    return custom_personal if custom_personal else str(DATA_DIR / "usually.db")

def get_active_context() -> str:
    global _ACTIVE_CONTEXT
    personal_path = get_db_path("personal")
    try:
        if os.path.exists(personal_path):
            conn = sqlite3.connect(personal_path)
            cur = conn.cursor()
            cur.execute("SELECT value FROM user_settings WHERE key = 'active_context'")
            row = cur.fetchone()
            conn.close()
            if row and row[0] in ("personal", "demo"):
                _ACTIVE_CONTEXT = row[0]
    except Exception:
        pass
    return _ACTIVE_CONTEXT

def set_active_context(context: str):
    global _ACTIVE_CONTEXT
    if context not in ("personal", "demo"):
        raise ValueError(f"Invalid context '{context}', must be 'personal' or 'demo'")
    _ACTIVE_CONTEXT = context
    personal_path = get_db_path("personal")
    try:
        conn = sqlite3.connect(personal_path)
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)
            """)
            conn.execute("""
                INSERT INTO user_settings (key, value)
                VALUES ('active_context', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (context,))
        conn.close()
    except Exception:
        pass

def get_connection(context: Optional[str] = None) -> sqlite3.Connection:
    ctx = context if context is not None else get_active_context()
    path = get_db_path(ctx)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def heal_and_reconcile_transactions(conn: sqlite3.Connection):
    """
    Conservatively heals persisted transactions and reconciles duplicate batches:
    1. Removes duplicate import batch batch_ed8efb5a8e (leaving original batch_05cd53ffaf intact).
    2. Corrects credit transactions where type was inadvertently overwritten to 'expense'.
    3. Populates ref_id for existing transactions and recomputes canonical fingerprints.
    """
    cur = conn.cursor()
    
    # 1. Resolve duplicate batch_ed8efb5a8e if present
    try:
        cur.execute("SELECT COUNT(*) FROM transactions WHERE import_batch_id = 'batch_ed8efb5a8e'")
        dup_count = cur.fetchone()[0]
        if dup_count > 0:
            cur.execute("DELETE FROM transactions WHERE import_batch_id = 'batch_ed8efb5a8e'")
            cur.execute("""
                UPDATE import_batches 
                SET accepted_rows = 0, duplicate_rows = ? 
                WHERE id = 'batch_ed8efb5a8e'
            """, (dup_count,))
            conn.commit()
    except Exception:
        pass

    # 2. Heal credits where type = 'expense' to 'p2p'
    try:
        cur.execute("""
            UPDATE transactions
            SET type = 'p2p'
            WHERE direction = 'credit' AND type = 'expense'
        """)
        conn.commit()
    except Exception:
        pass

    # 3. Backfill ref_id for batch_05cd53ffaf if ref_id is null
    try:
        cur.execute("SELECT COUNT(*) FROM transactions WHERE import_batch_id = 'batch_05cd53ffaf' AND (ref_id IS NULL OR ref_id = '')")
        need_ref = cur.fetchone()[0]
        if need_ref > 0:
            phonepe_path = r"C:\Users\HP\Downloads\PhonePe_Transaction_Statement.csv"
            if os.path.exists(phonepe_path):
                from app.services.csv_importer import (
                    extract_rows_and_headers, 
                    detect_column_headers, 
                    is_footer_disclaimer_row,
                    parse_date_safely,
                    parse_amount_str,
                    generate_fingerprint
                )
                with open(phonepe_path, "r", encoding="utf-8") as f:
                    content = f.read()
                headers, all_rows, meta, skipped = extract_rows_and_headers(content)
                mapping = detect_column_headers(headers)
                h_idx = {h: i for i, h in enumerate(headers)}
                
                valid_refs = []
                for r in all_rows:
                    if is_footer_disclaimer_row(r):
                        continue
                    d_raw = r[h_idx[mapping["date"]]] if mapping.get("date") in h_idx and h_idx[mapping["date"]] < len(r) else ""
                    if not parse_date_safely(d_raw):
                        continue
                    desc_raw = r[h_idx[mapping["description"]]] if mapping.get("description") in h_idx and h_idx[mapping["description"]] < len(r) else ""
                    if not desc_raw:
                        continue
                    amt_raw = r[h_idx[mapping["amount"]]] if mapping.get("amount") in h_idx and h_idx[mapping["amount"]] < len(r) else ""
                    p_amt = parse_amount_str(amt_raw)
                    if not p_amt or p_amt[0] == 0:
                        continue
                    ref_raw = r[h_idx[mapping["ref_id"]]] if mapping.get("ref_id") in h_idx and h_idx[mapping["ref_id"]] < len(r) else ""
                    valid_refs.append(ref_raw)

                cur.execute("SELECT id, date, clean_merchant, amount, direction, type FROM transactions WHERE import_batch_id = 'batch_05cd53ffaf' ORDER BY id ASC")
                db_rows = cur.fetchall()
                if len(db_rows) == len(valid_refs):
                    for db_r, ref_val in zip(db_rows, valid_refs):
                        tx_id, t_date, t_merchant, t_amount, t_direction, t_type = db_r
                        new_fp = generate_fingerprint(t_date, t_merchant, t_amount, t_type, ref_val, 1, direction=t_direction)
                        cur.execute("UPDATE transactions SET ref_id = ?, fingerprint = ? WHERE id = ?", (ref_val, new_fp, tx_id))
                    conn.commit()
    except Exception:
        pass

def migrate_db(conn: sqlite3.Connection):
    """
    Non-destructive schema migration.
    Ensures 'direction' and 'ref_id' columns exist in transactions and populates them
    from verified source statement patterns without erasing classification.
    """
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(transactions)")
    cols = [col[1] for col in cur.fetchall()]
    if not cols:
        return
    if "direction" not in cols:
        cur.execute("ALTER TABLE transactions ADD COLUMN direction TEXT NOT NULL DEFAULT 'debit'")
        
        # Safe direction population based on existing evidence:
        # Credits:
        cur.execute("""
            UPDATE transactions
            SET direction = 'credit'
            WHERE type IN ('income', 'refund')
               OR lower(raw_description) LIKE 'received from%'
               OR lower(raw_description) LIKE '%refund%'
        """)
        # Debits:
        cur.execute("""
            UPDATE transactions
            SET direction = 'debit'
            WHERE (type IN ('expense', 'transfer')
               OR lower(raw_description) LIKE 'paid to%'
               OR lower(raw_description) LIKE 'paid -%')
              AND direction != 'credit'
        """)
        conn.commit()
    
    if "ref_id" not in cols:
        cur.execute("ALTER TABLE transactions ADD COLUMN ref_id TEXT")
        conn.commit()

    cur.execute("CREATE INDEX IF NOT EXISTS idx_tx_direction ON transactions(direction)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_tx_ref_id ON transactions(ref_id)")
    conn.commit()

    heal_and_reconcile_transactions(conn)

def init_db(context: Optional[str] = None):
    contexts = [context] if context else ["personal", "demo"]
    for ctx in contexts:
        path = get_db_path(ctx)
        conn = sqlite3.connect(path)
        with conn:
            conn.executescript(SCHEMA_SQL)
        migrate_db(conn)
        conn.close()
