from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import setup_logging
from app.core.settings import get_settings
from app.db.pool import create_pool
from app.routers.admin import router as admin_router
from app.routers.forest import router as forest_router
from app.routers.nft import router as nft_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    app.state.started_at = datetime.now(UTC).isoformat(timespec="seconds")
    app.state.pool = await create_pool(get_settings().database_url)
    yield
    if app.state.pool is not None:
        await app.state.pool.close()


app = FastAPI(title="GreenChain Timber API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_origin_regex=get_settings().cors_origin_regex or None,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forest_router)
app.include_router(admin_router)
app.include_router(nft_router)


@app.get("/healthz")
async def healthz():
    db = "down"
    if app.state.pool is not None:
        try:
            async with app.state.pool.acquire(timeout=5) as conn:
                await conn.fetchval("select 1")
            db = "up"
        except Exception:
            db = "down"
    return {
        "status": "ok",
        "db": db,
        # 部署驗證用：線上實際跑的 commit 與本次啟動時間（冷啟後會更新）
        "version": get_settings().build_version,
        "started_at": getattr(app.state, "started_at", None),
    }
