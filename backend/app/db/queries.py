"""SQL 查詢層：防重疊（FR-3.1–3.2）、入庫 transaction、清單/詳情（§8.2–8.3）."""

import json
import uuid

import asyncpg

from app.services.carbon_calc import CarbonEstimate

OVERLAP_THRESHOLD_HA = 0.001  # FR-3.2：約 10 m2，容忍圖徵誤差

_OVERLAP_SQL = """
select id,
       st_area(st_transform(st_intersection(geom, g.new_geom), 3826)) / 10000.0 as overlap_ha,
       st_asgeojson(st_intersection(geom, g.new_geom)) as overlap_geojson
from forest_plots,
     (select st_setsrid(st_geomfromgeojson($1), 4326) as new_geom) as g
where status != 'rejected'
  and st_intersects(geom, g.new_geom)
"""

_INSERT_PLOT_SQL = """
insert into forest_plots
    (owner_id, name, species, avg_age, density, geom, area_ha, geo_hash, status)
values ($1, $2, $3, $4, $5, st_setsrid(st_geomfromgeojson($6), 4326), $7, $8, 'chain_pending')
returning id, area_ha, status, created_at
"""

_INSERT_ESTIMATE_SQL = """
insert into carbon_estimates (plot_id, formula_version, input_snapshot, year_offset, co2e_tons)
values ($1, $2, $3, $4, $5)
"""

_LIST_SQL = """
select p.id, p.name, p.species, p.area_ha, p.status, p.created_at,
       ce.co2e_tons as co2e_current,
       st_asgeojson(st_simplifypreservetopology(p.geom, 0.0001)) as geometry_simplified
from forest_plots p
left join carbon_estimates ce on ce.plot_id = p.id and ce.year_offset = 0
order by p.created_at desc
"""

_GET_SQL = """
select p.id, p.owner_id, p.name, p.species, p.avg_age, p.density, p.area_ha,
       p.geo_hash, p.status, p.created_at,
       st_asgeojson(p.geom) as geometry
from forest_plots p
where p.id = $1
"""

_GET_ESTIMATES_SQL = """
select formula_version, year_offset, co2e_tons
from carbon_estimates where plot_id = $1 order by year_offset
"""

_GET_CHAIN_SQL = """
select contract_address, token_id, tx_hash, chain_id, minted_at
from chain_records where plot_id = $1
"""


async def find_overlaps(conn: asyncpg.Connection, geometry: dict) -> list[dict]:
    rows = await conn.fetch(_OVERLAP_SQL, json.dumps(geometry))
    return [
        {
            "plot_id": str(r["id"]),
            "overlap_ha": round(float(r["overlap_ha"]), 4),
            "overlap_geojson": json.loads(r["overlap_geojson"]),
        }
        for r in rows
        if float(r["overlap_ha"]) > OVERLAP_THRESHOLD_HA
    ]


async def insert_plot_with_estimates(
    conn: asyncpg.Connection,
    *,
    owner_id: uuid.UUID,
    name: str,
    species: str,
    avg_age: int,
    density: int,
    geometry: dict,
    area_ha: float,
    geo_hash: str,
    estimate: CarbonEstimate,
) -> dict:
    async with conn.transaction():
        row = await conn.fetchrow(
            _INSERT_PLOT_SQL,
            owner_id, name, species, avg_age, density,
            json.dumps(geometry), area_ha, geo_hash,
        )
        await conn.executemany(
            _INSERT_ESTIMATE_SQL,
            [
                (
                    row["id"],
                    estimate.formula_version,
                    json.dumps(estimate.input_snapshot, ensure_ascii=False),
                    y.year_offset,
                    y.co2e_tons,
                )
                for y in estimate.yearly
            ],
        )
    return {
        "id": str(row["id"]),
        "area_ha": float(row["area_ha"]),
        "status": row["status"],
        "created_at": row["created_at"].isoformat(),
    }


async def list_plots(conn: asyncpg.Connection) -> list[dict]:
    rows = await conn.fetch(_LIST_SQL)
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "species": r["species"],
            "area_ha": float(r["area_ha"]),
            "status": r["status"],
            "co2e_current": float(r["co2e_current"]) if r["co2e_current"] is not None else None,
            "geometry_simplified": json.loads(r["geometry_simplified"]),
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


async def get_plot(conn: asyncpg.Connection, plot_id: uuid.UUID) -> dict | None:
    row = await conn.fetchrow(_GET_SQL, plot_id)
    if row is None:
        return None
    estimates = await conn.fetch(_GET_ESTIMATES_SQL, plot_id)
    chain = await conn.fetchrow(_GET_CHAIN_SQL, plot_id)
    return {
        "id": str(row["id"]),
        "owner_id": str(row["owner_id"]),
        "name": row["name"],
        "species": row["species"],
        "avg_age": row["avg_age"],
        "density": row["density"],
        "area_ha": float(row["area_ha"]),
        "geo_hash": row["geo_hash"],
        "status": row["status"],
        "created_at": row["created_at"].isoformat(),
        "geometry": json.loads(row["geometry"]),
        "estimates": [
            {
                "formula_version": e["formula_version"],
                "year_offset": e["year_offset"],
                "co2e_tons": float(e["co2e_tons"]),
            }
            for e in estimates
        ],
        "chain_record": (
            {
                "contract_address": chain["contract_address"],
                "token_id": chain["token_id"],
                "tx_hash": chain["tx_hash"],
                "chain_id": chain["chain_id"],
                "minted_at": chain["minted_at"].isoformat() if chain["minted_at"] else None,
            }
            if chain
            else None
        ),
    }
