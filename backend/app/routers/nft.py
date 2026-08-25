"""NFT metadata 端點（§9 tokenURI 指向；公開無 JWT——區塊鏈瀏覽器需可讀）."""

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.db.pool import get_conn

router = APIRouter(prefix="/api/nft", tags=["nft"])

_METADATA_SQL = """
select p.name, p.species, p.area_ha, p.geo_hash, cr.token_id, ce.co2e_tons
from chain_records cr
join forest_plots p on p.id = cr.plot_id
join carbon_estimates ce on ce.plot_id = p.id and ce.year_offset = 0
where cr.token_id = $1
"""

_SPECIES_ZH = {"taiwania": "台灣杉", "acacia": "相思樹", "fraxinus": "光臘樹"}


@router.get("/{token_id}/metadata")
async def nft_metadata(token_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    row = await conn.fetchrow(_METADATA_SQL, token_id)
    if row is None:
        raise HTTPException(status_code=404, detail="token not found")
    return {
        "name": f"GreenChain Timber #{token_id} — {row['name']}",
        "description": "綠鏈林匯林區碳資產存證。鏈上 geoHash 為林區邊界正規化 GeoJSON 之 "
        "SHA-256 指紋；估算為示範性質，非經查證之減量額度。",
        "attributes": [
            {"trait_type": "樹種", "value": _SPECIES_ZH.get(row["species"], row["species"])},
            {"trait_type": "面積 (ha)", "value": float(row["area_ha"])},
            {"trait_type": "當年固碳量 (噸 CO2e/年)", "value": float(row["co2e_tons"])},
            {"trait_type": "geoHash", "value": row["geo_hash"]},
        ],
    }
