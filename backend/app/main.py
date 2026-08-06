from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import setup_logging
from app.core.settings import get_settings
from app.db.pool import create_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    app.state.pool = await create_pool(get_settings().database_url)
    yield
    if app.state.pool is not None:
        await app.state.pool.close()


app = FastAPI(title="GreenChain Timber API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz():
    db = "down"
    if app.state.pool is not None:
        try:
            async with app.state.pool.acquire() as conn:
                await conn.fetchval("select 1")
            db = "up"
        except Exception:
            db = "down"
    return {"status": "ok", "db": db}
