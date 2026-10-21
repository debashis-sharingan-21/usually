import uuid
import json
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Depends
from app.config import is_public_demo, is_hosted_mode, get_personal_db_path
from app.database import get_connection, set_active_context
from app.workspace import get_current_workspace, require_personal_workspace, WorkspaceContext
from app.services.csv_importer import parse_and_preview_csv, execute_import
from app.models.schema import CSVPreviewResponse, CSVImportResult, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.post("/preview", response_model=CSVPreviewResponse)
async def preview_csv(
    file: UploadFile = File(...),
    mapping: Optional[str] = Form(None),
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    if is_public_demo() and not workspace.is_authenticated:
        raise HTTPException(
            status_code=403,
            detail="Mutations are disabled in public demo mode. Run Usually locally for private data and statement imports."
        )

    try:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8", errors="replace")
        content = content.replace("\r\n", "\n").replace("\r", "\n")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {str(e)}")

    user_mapping = None
    if mapping:
        try:
            user_mapping = json.loads(mapping)
        except Exception:
            pass

    try:
        preview_result = parse_and_preview_csv(content, user_mapping=user_mapping)
        preview_result["filename"] = file.filename
        return preview_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV statement: {str(e)}")

@router.post("/import", response_model=CSVImportResult)
async def import_csv(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    currency: str = Form("INR"),
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    try:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8", errors="replace")
        content = content.replace("\r\n", "\n").replace("\r", "\n")
        col_mapping = json.loads(mapping)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload or CSV: {str(e)}")

    batch_id = f"batch_{uuid.uuid4().hex[:10]}"
    if not is_hosted_mode() and not is_public_demo() and workspace.workspace_type == "demo":
        workspace = WorkspaceContext(
            workspace_type="personal",
            db_path=get_personal_db_path(),
            is_authenticated=False
        )
        set_active_context("personal")

    conn = get_connection(workspace=workspace)
    try:
        result = execute_import(
            conn=conn,
            batch_id=batch_id,
            filename=file.filename,
            csv_content=content,
            mapping=col_mapping,
            currency=currency
        )
        return result
    finally:
        conn.close()

@router.get("")
def list_transactions(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    category: Optional[str] = None,
    merchant: Optional[str] = None,
    direction: Optional[str] = None,
    tx_type: Optional[str] = None,
    search: Optional[str] = None,
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        cur = conn.cursor()
        query = "SELECT id, import_batch_id, date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at FROM transactions WHERE 1=1"
        params = []

        if category:
            query += " AND category = ?"
            params.append(category)
        if merchant:
            query += " AND clean_merchant = ?"
            params.append(merchant)
        if direction:
            query += " AND direction = ?"
            params.append(direction)
        if tx_type:
            query += " AND type = ?"
            params.append(tx_type)
        if search:
            query += " AND (clean_merchant LIKE ? OR raw_description LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])

        count_query = query.replace("SELECT id, import_batch_id, date, raw_description, clean_merchant, category, amount, direction, type, currency, fingerprint, is_user_modified, created_at", "SELECT COUNT(*)")
        cur.execute(count_query, params)
        total_count = cur.fetchone()[0]

        query += " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cur.execute(query, params)
        rows = cur.fetchall()

        items = []
        for r in rows:
            items.append({
                "id": r[0],
                "import_batch_id": r[1],
                "date": r[2],
                "raw_description": r[3],
                "clean_merchant": r[4],
                "category": r[5],
                "amount": r[6],
                "direction": r[7],
                "type": r[8],
                "currency": r[9],
                "fingerprint": r[10],
                "is_user_modified": bool(r[11]),
                "created_at": r[12]
            })

        return {
            "total": total_count,
            "items": items,
            "limit": limit,
            "offset": offset
        }
    finally:
        conn.close()

@router.put("/{tx_id}")
def update_transaction(
    tx_id: int,
    payload: TransactionUpdate,
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    conn = get_connection(workspace=workspace)
    try:
        cur = conn.cursor()
        updates = []
        params = []
        if payload.clean_merchant is not None:
            updates.append("clean_merchant = ?")
            params.append(payload.clean_merchant)
        if payload.category is not None:
            updates.append("category = ?")
            params.append(payload.category)
        if payload.direction is not None:
            updates.append("direction = ?")
            params.append(payload.direction)
        if payload.type is not None:
            updates.append("type = ?")
            params.append(payload.type)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        updates.append("is_user_modified = 1")
        params.append(tx_id)

        sql = f"UPDATE transactions SET {', '.join(updates)} WHERE id = ?"
        cur.execute(sql, params)
        conn.commit()

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")

        return {"status": "success", "id": tx_id}
    finally:
        conn.close()

@router.delete("")
def delete_all_transactions(
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    """Privacy control: permanently removes all imported transactions and batches from the user's workspace."""
    conn = get_connection(workspace=workspace)
    try:
        with conn:
            conn.execute("DELETE FROM transactions")
            conn.execute("DELETE FROM import_batches")
            conn.execute("DELETE FROM habit_feedback")
        return {
            "status": "success",
            "message": f"All transactions and batches cleared permanently for {workspace.workspace_type} workspace."
        }
    finally:
        conn.close()
