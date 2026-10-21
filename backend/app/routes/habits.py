from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from app.database import get_connection
from app.guards import verify_write_permission
from app.services.habit_engine import detect_habits
from app.models.schema import HabitObservation, HabitFeedbackRequest
from app.services.ai_generator import generate_observation_with_ai

router = APIRouter(prefix="/api/habits", tags=["Habits"])

@router.get("", response_model=List[HabitObservation])
def get_habits(reference_date: Optional[str] = None):
    conn = get_connection()
    try:
        detected = detect_habits(conn, reference_date=reference_date)
        results = []
        for h in detected:
            title, headline, message, gen_by = generate_observation_with_ai(h)
            results.append(HabitObservation(
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
                generated_by=gen_by
            ))
        return results
    finally:
        conn.close()

@router.post("/feedback", dependencies=[Depends(verify_write_permission)])
def update_habit_feedback(payload: HabitFeedbackRequest):
    if payload.status not in ("confirmed", "muted", "active"):
        raise HTTPException(status_code=400, detail="Status must be 'confirmed', 'muted', or 'active'")

    conn = get_connection()
    try:
        now_iso = datetime.now().isoformat()
        with conn:
            conn.execute("""
                INSERT INTO habit_feedback (habit_key, status, notes, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(habit_key) DO UPDATE SET
                    status=excluded.status,
                    notes=excluded.notes,
                    updated_at=excluded.updated_at
            """, (payload.habit_key, payload.status, payload.notes, now_iso))
        return {"status": "success", "habit_key": payload.habit_key, "new_status": payload.status}
    finally:
        conn.close()
