from fastapi import APIRouter, HTTPException
from app.database import get_connection
from app.services.accounting import calculate_spending_summary
from app.services.ai_generator import check_ollama_status
from app.services.demo_data import load_realistic_demo_dataset
from app.services.habit_engine import detect_habits
from app.services.ai_generator import generate_observation_with_ai
from app.models.schema import SpendingSummaryResponse, SystemHealthResponse, HabitObservation, UserSettingsUpdate
from typing import List

router = APIRouter(prefix="/api", tags=["System & Accounting"])

@router.get("/accounting/summary", response_model=SpendingSummaryResponse)
def get_accounting_summary():
    conn = get_connection()
    try:
        summary = calculate_spending_summary(conn)
        return summary
    finally:
        conn.close()

@router.get("/system/health", response_model=SystemHealthResponse)
def get_health():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM transactions")
        tx_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM import_batches")
        batch_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM import_batches WHERE id = 'demo_batch_2026'")
        is_demo = cur.fetchone()[0] > 0

        # Pending one-tap questions count
        cur.execute("SELECT COUNT(*) FROM payee_questions WHERE status = 'pending'")
        pending_q = cur.fetchone()[0]

        # Current tone
        cur.execute("SELECT value FROM user_settings WHERE key = 'tone'")
        tone_row = cur.fetchone()
        tone_val = tone_row[0] if tone_row else "playful"

        ollama_ok, model_name = check_ollama_status()

        return SystemHealthResponse(
            status="healthy",
            db_connected=True,
            transaction_count=tx_count,
            batch_count=batch_count,
            ollama_available=ollama_ok,
            ollama_model=model_name,
            is_demo_mode=is_demo,
            pending_questions_count=pending_q,
            current_tone=tone_val
        )
    finally:
        conn.close()

@router.put("/system/tone")
def update_tone(payload: UserSettingsUpdate):
    if payload.tone not in ("playful", "dry", "minimal"):
        raise HTTPException(status_code=400, detail="Tone must be 'playful', 'dry', or 'minimal'")

    conn = get_connection()
    try:
        with conn:
            conn.execute("""
                INSERT INTO user_settings (key, value)
                VALUES ('tone', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (payload.tone,))
        return {"status": "success", "tone": payload.tone}
    finally:
        conn.close()

@router.post("/system/seed-demo")
def seed_demo_data():
    conn = get_connection()
    try:
        count = load_realistic_demo_dataset(conn)
        return {"status": "success", "message": f"Loaded {count} realistic transactions.", "count": count}
    finally:
        conn.close()

@router.post("/system/clear-data")
def clear_all_data():
    conn = get_connection()
    try:
        with conn:
            conn.execute("DELETE FROM transactions")
            conn.execute("DELETE FROM import_batches")
            conn.execute("DELETE FROM habit_feedback")
            conn.execute("DELETE FROM learned_payees")
            conn.execute("DELETE FROM payee_questions")
        return {"status": "success", "message": "All data cleared successfully."}
    finally:
        conn.close()

@router.get("/notifications", response_model=List[HabitObservation])
def get_notifications():
    """
    Returns the evidence-backed notification feed.
    Cards are ranked by freshness and confidence.
    """
    conn = get_connection()
    try:
        detected = detect_habits(conn)
        notifications = []
        for h in detected:
            if h.get("status") == "muted":
                continue
            title, headline, message, gen_by = generate_observation_with_ai(h)
            notifications.append(HabitObservation(
                habit_key=h["habit_key"],
                title=title,
                headline=headline,
                message=message,
                habit_type=h["habit_type"],
                merchant=h["merchant"],
                category=h["category"],
                confidence=h["confidence"],
                min_evidence_met=h["min_evidence_met"],
                evidence=h["evidence"],
                observation_window=h["observation_window"],
                last_observed_date=h["last_observed_date"],
                freshness_status=h["freshness_status"],
                status=h["status"],
                generated_by=gen_by,
                tone=h.get("tone", "playful")
            ))
        notifications.sort(key=lambda x: x.confidence, reverse=True)
        return notifications
    finally:
        conn.close()
