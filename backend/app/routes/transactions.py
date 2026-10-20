import uuid
from typing import Optional, List, Dict
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from app.database import get_connection
from app.services.csv_importer import parse_and_preview_csv, execute_import
from app.models.schema import CSVPreviewResponse, CSVImportResult, TransactionUpdate
import json

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.post("/preview", response_model=CSVPreviewResponse)
async def preview_csv(
    file: UploadFile = File(...),
    mapping: Optional[str] = Form(None)
):
    try:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {str(e)}")

    user_mapping = None
    if mapping:
        try:
            user_mapping = json.loads(mapping)
        except Exception:
            pass

    preview_result = parse_and_preview_csv(content, user_mapping=user_mapping)
    preview_result["filename"] = file.filename
    return preview_result

@router.post("/import", response_model=CSVImportResult)
async def import_csv(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    currency: str = Form("INR")
):
    try:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8", errors="replace")
        col_mapping = json.loads(mapping)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload or CSV: {str(e)}")

    batch_id = f"batch_{uuid.uuid4().hex[:10]}"
    conn = get_connection()
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
    tx_type: Optional[str] = None,
    search: Optional[str] = None
):
    conn = get_connection()
    try:
        cur = conn.cursor()
        query = "SELECT id, import_batch_id, date, raw_description, clean_merchant, category, amount, type, currency, fingerprint, is_user_modified, created_at FROM transactions WHERE 1=1"
        params = []

        if category:
            query += " AND category = ?"
            params.append(category)
        if merchant:
            query += " AND clean_merchant = ?"
            params.append(merchant)
        if tx_type:
            query += " AND type = ?"
            params.append(tx_type)
        if search:
            query += " AND (clean_merchant LIKE ? OR raw_description LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])

        # Count total
        count_query = query.replace("SELECT id, import_batch_id, date, raw_description, clean_merchant, category, amount, type, currency, fingerprint, is_user_modified, created_at", "SELECT COUNT(*)")
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
                "type": r[7],
                "currency": r[8],
                "fingerprint": r[9],
                "is_user_modified": bool(r[10]),
                "created_at": r[11]
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
def update_transaction(tx_id: int, payload: TransactionUpdate):
    conn = get_connection()
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
def delete_all_transactions():
    """Privacy control: permanently removes all imported transactions and batches from local machine."""
    conn = get_connection()
    try:
        with conn:
            conn.execute("DELETE FROM transactions")
            conn.execute("DELETE FROM import_batches")
            conn.execute("DELETE FROM habit_feedback")
        return {"status": "success", "message": "All transactions and batches cleared permanently from local disk."}
    finally:
        conn.close()
