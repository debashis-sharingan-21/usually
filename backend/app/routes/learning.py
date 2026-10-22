from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.database import get_connection
from app.workspace import get_current_workspace, require_personal_workspace, WorkspaceContext
from app.services.learning_engine import (
    get_pending_questions,
    get_or_generate_question_suggestion,
    answer_payee_question,
    dismiss_payee_question,
    list_learned_payees
)
from app.models.schema import PayeeQuestion, PayeeAnswerRequest

router = APIRouter(prefix="/api/learning", tags=["Persistent Learning"])

@router.get("/questions", response_model=List[PayeeQuestion])
def fetch_questions(
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        return get_pending_questions(conn)
    finally:
        conn.close()

@router.post("/questions/{question_id}/suggest", response_model=PayeeQuestion)
def request_question_suggestion(
    question_id: str,
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        return get_or_generate_question_suggestion(conn, question_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    finally:
        conn.close()

@router.post("/answer")
def submit_answer(
    payload: PayeeAnswerRequest,
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        res = answer_payee_question(
            conn=conn,
            question_id=payload.question_id,
            selected_option_id=payload.selected_option_id,
            custom_category=payload.custom_category,
            custom_type=payload.custom_type,
            notes=payload.notes
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.post("/dismiss/{question_id}")
def dismiss_question(
    question_id: str,
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        return dismiss_payee_question(conn, question_id)
    finally:
        conn.close()

@router.get("/rules")
def fetch_rules(
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        return list_learned_payees(conn)
    finally:
        conn.close()
