import logging

import asyncpg
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)


async def create_pool(database_url: str) -> asyncpg.Pool | None:
    """建立連線池；失敗回傳 None（服務仍可啟動，healthz 回報 db down）."""
    try:
        return await asyncpg.create_pool(database_url, min_size=1, max_size=5, timeout=10)
    except Exception:
        logger.exception("database pool creation failed")
        return None


async def get_conn(request: Request):
    """FastAPI dependency：從 app.state.pool 取連線."""
    pool: asyncpg.Pool | None = request.app.state.pool
    if pool is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    async with pool.acquire() as conn:
        yield conn
