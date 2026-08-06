"""AT-6 驗證：資料庫 GeoJSON 依正規化規則重算 SHA-256，與鏈上 geoHash 比對.

用法（backend/）:
    uv run python scripts/verify_hash.py            # 驗證所有 on_chain 林區
    uv run python scripts/verify_hash.py <plot_id>  # 驗證單一林區
環境變數（.env）: DATABASE_URL, CHAIN_RPC_URL, NFT_CONTRACT_ADDRESS
"""

import asyncio
import json
import os
import pathlib
import sys

import asyncpg
from web3 import Web3

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.services.chain_codec import GREEN_ASSET_ABI  # noqa: E402
from app.services.geo_service import geometry_hash  # noqa: E402


def _load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    env_path = pathlib.Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip().strip('"\'')
    env.update(
        {
            k: v
            for k, v in os.environ.items()
            if k in ("DATABASE_URL", "CHAIN_RPC_URL", "NFT_CONTRACT_ADDRESS")
        }
    )
    return env


_SQL_ALL = """
select p.id, p.name, p.geo_hash, cr.token_id, st_asgeojson(p.geom) as geometry
from forest_plots p join chain_records cr on cr.plot_id = p.id
where p.status = 'on_chain' and cr.token_id is not null
"""


async def main() -> None:
    env = _load_env()
    plot_filter = sys.argv[1] if len(sys.argv) > 1 else None

    conn = await asyncpg.connect(env["DATABASE_URL"])
    try:
        rows = await conn.fetch(_SQL_ALL)
    finally:
        await conn.close()
    if plot_filter:
        rows = [r for r in rows if str(r["id"]) == plot_filter]
    if not rows:
        print("查無 on_chain 林區")
        return

    w3 = Web3(Web3.HTTPProvider(env.get("CHAIN_RPC_URL", "https://rpc-amoy.polygon.technology")))
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(env["NFT_CONTRACT_ADDRESS"]), abi=GREEN_ASSET_ABI
    )

    mismatch = 0
    for row in rows:
        recomputed = geometry_hash(json.loads(row["geometry"]))
        on_chain = contract.functions.getPlotData(row["token_id"]).call()[0].hex()
        db_hash = row["geo_hash"]
        ok = recomputed == on_chain == db_hash
        status = "MATCH" if ok else "MISMATCH"
        if not ok:
            mismatch += 1
        print(f"[{status}] {row['name']} (token #{row['token_id']})")
        print(f"    DB geo_hash : {db_hash}")
        print(f"    重算 SHA-256 : {recomputed}")
        print(f"    鏈上 geoHash : {on_chain}")

    print(f"\n{len(rows) - mismatch}/{len(rows)} MATCH")
    if mismatch:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
