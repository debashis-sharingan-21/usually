from fastapi import APIRouter, HTTPException, Depends
from app.config import is_public_demo, get_deployment_mode, is_hosted_mode
from app.workspace import get_current_workspace, require_personal_workspace, WorkspaceContext
from app.database import get_connection, get_active_context, set_active_context
from app.services.accounting import calculate_spending_summary
from app.services.ai_generator import check_ollama_status
from app.services.demo_data import load_realistic_demo_dataset
from app.models.schema import SpendingSummaryResponse, SystemHealthResponse, UserSettingsUpdate

router = APIRouter(prefix="/api", tags=["System & Accounting"])

@router.get("/accounting/summary", response_model=SpendingSummaryResponse)
def get_accounting_summary(
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        summary = calculate_spending_summary(conn)
        return summary
    finally:
        conn.close()

@router.get("/system/health", response_model=SystemHealthResponse)
def get_health(
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM transactions")
        tx_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM import_batches")
        batch_count = cur.fetchone()[0]

        is_demo = (workspace.workspace_type == "demo")

        # Pending one-tap questions count in active context
        cur.execute("SELECT COUNT(*) FROM payee_questions WHERE status = 'pending'")
        pending_q = cur.fetchone()[0]

        # Current tone
        cur.execute("SELECT value FROM user_settings WHERE key = 'tone'")
        tone_row = cur.fetchone()
        tone_val = tone_row[0] if tone_row else "playful"

        ollama_ok, model_name = check_ollama_status()

        # Check if personal data exists
        has_personal = False
        if workspace.workspace_type == "personal":
            has_personal = tx_count > 0
        elif not is_hosted_mode() and not is_public_demo():
            try:
                p_conn = get_connection(context="personal")
                p_cur = p_conn.cursor()
                p_cur.execute("SELECT COUNT(*) FROM transactions")
                has_personal = p_cur.fetchone()[0] > 0
                p_conn.close()
            except Exception:
                pass

        return SystemHealthResponse(
            status="healthy",
            db_connected=True,
            transaction_count=tx_count,
            batch_count=batch_count,
            ollama_available=ollama_ok,
            ollama_model=model_name,
            is_demo_mode=is_demo,
            pending_questions_count=pending_q,
            current_tone=tone_val,
            active_context=workspace.workspace_type,
            has_personal_data=has_personal,
            deployment_mode=get_deployment_mode()
        )
    finally:
        conn.close()

@router.get("/system/context")
def get_context(
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    return {
        "active_context": workspace.workspace_type,
        "user_id": workspace.user_id,
        "is_guest": workspace.is_guest
    }

@router.post("/system/context")
def switch_context(
    payload: dict,
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    if is_public_demo() and not workspace.is_authenticated:
        raise HTTPException(
            status_code=403,
            detail="Mutations are disabled in public demo mode. Run Usually locally for private data and statement imports."
        )
    target_context = payload.get("context", "personal")
    if target_context not in ("personal", "demo"):
        raise HTTPException(status_code=400, detail="Context must be 'personal' or 'demo'")
    if not is_hosted_mode() and not is_public_demo():
        set_active_context(target_context)
    return {"status": "success", "active_context": target_context}

@router.put("/system/tone")
def update_tone(
    payload: UserSettingsUpdate,
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    if payload.tone not in ("playful", "dry", "minimal"):
        raise HTTPException(status_code=400, detail="Tone must be 'playful', 'dry', or 'minimal'")

    conn = get_connection(workspace=workspace)
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
def seed_demo_data(
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    if is_public_demo() or is_hosted_mode():
        raise HTTPException(status_code=403, detail="Direct demo seeding is disabled in hosted mode.")
    conn = get_connection(context="demo")
    try:
        count = load_realistic_demo_dataset(conn)
        set_active_context("demo")
        return {"status": "success", "message": f"Loaded {count} realistic transactions.", "count": count, "active_context": "demo"}
    finally:
        conn.close()

@router.post("/system/clear-data")
def clear_all_data(
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        with conn:
            conn.execute("DELETE FROM transactions")
            conn.execute("DELETE FROM import_batches")
            conn.execute("DELETE FROM habit_feedback")
            conn.execute("DELETE FROM learned_payees")
            conn.execute("DELETE FROM payee_questions")
        return {"status": "success", "message": f"All data cleared successfully for {workspace.workspace_type} workspace."}
    finally:
        conn.close()
