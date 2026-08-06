"""將 app/db/schema.sql 套用到 DATABASE_URL 指向的資料庫（冪等，可重放）.

用法（於 backend/）：uv run python scripts/apply_schema.py
"""

import asyncio
import os
import pathlib
import sys

import asyncpg


async def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        # 允許從 .env 讀取（本機開發便利）
        env_path = pathlib.Path(__file__).resolve().parents[1] / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                if line.startswith("DATABASE_URL="):
                    database_url = line.split("=", 1)[1].strip()
    if not database_url:
        sys.exit("DATABASE_URL 未設定（環境變數或 backend/.env）")
    database_url = database_url.strip().strip('"\'')

    sql = (
        pathlib.Path(__file__).resolve().parents[1] / "app" / "db" / "schema.sql"
    ).read_text(encoding="utf-8")
    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute(sql)
        print("schema applied OK")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
