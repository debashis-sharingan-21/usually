from fastapi import APIRouter, Query, Depends
from typing import List, Optional
from datetime import datetime
import sqlite3
from app.database import get_connection
from app.workspace import get_current_workspace, WorkspaceContext
from app.services.habit_engine import detect_habits
from app.models.schema import HabitObservation
from app.services.ai_generator import generate_observation_with_ai

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

RECENT_WINDOW_DAYS = 30

@router.get("", response_model=List[HabitObservation])
def list_notifications(
    reference_date: Optional[str] = Query(None, description="ISO-8601 YYYY-MM-DD reference date for recency calculations"),
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    """
    Returns prioritized, evidence-backed notifications for the active database context.
    
    Enforces the 30-day Recent-Activity Policy:
    1. Observations must be supported by qualifying evidence within the rolling 30-day window.
    2. Muted topics from `habit_feedback` are strictly suppressed.
    3. Minimum confidence (>= 0.5) and minimum evidence requirements must be met.
    4. Observations are ranked by:
       - Confirmed user acknowledgment first
       - Recency of supporting transactions (days since last seen ascending)
       - Statistical confidence descending
    5. Returns an honest empty list if no recent activity qualifies.
    """
    conn = get_connection(workspace=workspace)
    try:
        raw_habits = detect_habits(conn, reference_date=reference_date)
        if not raw_habits:
            return []

        # Determine reference date for evaluating recency
        if reference_date:
            try:
                ref_dt = datetime.strptime(reference_date, "%Y-%m-%d").date()
            except ValueError:
                ref_dt = datetime.now().date()
        else:
            cur = conn.cursor()
            cur.execute("SELECT MAX(date) FROM transactions")
            max_d_row = cur.fetchone()
            if max_d_row and max_d_row[0]:
                ref_dt = datetime.strptime(max_d_row[0], "%Y-%m-%d").date()
            else:
                ref_dt = datetime.now().date()

        eligible = []
        for h in raw_habits:
            # 1. Respect muted feedback
            if h.get("status") == "muted":
                continue

            # 2. Minimum evidence safeguards
            if not h.get("min_evidence_met", False) or h.get("confidence", 0.0) < 0.5:
                continue

            # 3. 30-Day Recency Eligibility Policy
            last_seen_str = h.get("last_observed_date")
            if last_seen_str:
                try:
                    last_seen_dt = datetime.strptime(last_seen_str, "%Y-%m-%d").date()
                    days_since = (ref_dt - last_seen_dt).days
                except ValueError:
                    days_since = 999
            else:
                days_since = 999

            # Exclude dormant or stale habits (> 30 days old without recent triggering activity)
            if days_since > RECENT_WINDOW_DAYS:
                continue

            # Generate natural language presentation
            title, headline, message, gen_by = generate_observation_with_ai(h)
            h_obs = HabitObservation(
                habit_key=h["habit_key"],
                title=title,
                headline=headline,
                message=message,
                habit_type=h["habit_type"],
                merchant=h.get("merchant"),
                category=h.get("category"),
                confidence=h["confidence"],
                min_evidence_met=h["min_evidence_met"],
                evidence=h["evidence"],
                observation_window=h["observation_window"],
                last_observed_date=h.get("last_observed_date"),
                freshness_status="fresh" if days_since <= 14 else "quiet_recent",
                status=h.get("status", "active"),
                generated_by=gen_by,
                tone=h.get("tone", "playful")
            )
            eligible.append((h_obs, days_since))

        # 4. Rank observations:
        # - Confirmed first
        # - Most recent transaction date first (smallest days_since)
        # - Highest confidence next
        eligible.sort(key=lambda item: (
            0 if item[0].status == "confirmed" else 1,
            item[1],  # days_since
            -item[0].confidence
        ))

        return [item[0] for item in eligible]
    finally:
        conn.close()
