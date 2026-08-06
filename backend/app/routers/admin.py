"""管理端點（簡易保護：X-Admin-Token header，FR-5.3 手動補鑄）."""

import secrets
import uuid

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request

from app.core.settings import get_settings
from app.db.pool import get_conn
from app.services.chain_service import mint_and_record

router = APIRouter(prefix="/api/admin", tags=["admin"])

_PENDING_SQL = "select id from forest_plots where status = 'chain_pending'"


@router.post("/retry-pending")
async def retry_pending(
    request: Request,
    background_tasks: BackgroundTasks,
    x_admin_token: str | None = Header(default=None),
    conn: asyncpg.Connection = Depends(get_conn),
):
    settings = get_settings()
    if not settings.admin_token or not secrets.compare_digest(
        x_admin_token or "", settings.admin_token
    ):
        raise HTTPException(status_code=403, detail="forbidden")
    rows = await conn.fetch(_PENDING_SQL)
    for row in rows:
        background_tasks.add_task(
            mint_and_record, request.app.state.pool, uuid.UUID(str(row["id"]))
        )
    return {"retriggered": len(rows)}
