from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.database import get_connection
from app.guards import verify_write_permission
from app.services.learning_engine import (
    get_pending_questions,
    answer_payee_question,
    dismiss_payee_question,
    list_learned_payees
)
from app.models.schema import PayeeQuestion, PayeeAnswerRequest

router = APIRouter(prefix="/api/learning", tags=["Persistent Learning"])

@router.get("/questions", response_model=List[PayeeQuestion])
def fetch_questions():
    conn = get_connection()
    try:
        return get_pending_questions(conn)
    finally:
        conn.close()

@router.post("/answer", dependencies=[Depends(verify_write_permission)])
def submit_answer(payload: PayeeAnswerRequest):
    conn = get_connection()
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

@router.post("/dismiss/{question_id}", dependencies=[Depends(verify_write_permission)])
def dismiss_question(question_id: str):
    conn = get_connection()
    try:
        return dismiss_payee_question(conn, question_id)
    finally:
        conn.close()

@router.get("/rules")
def fetch_rules():
    conn = get_connection()
    try:
        return list_learned_payees(conn)
    finally:
        conn.close()
