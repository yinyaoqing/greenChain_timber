"""整合測試：需要 TEST_DATABASE_URL 指向已套用 schema.sql 的 PostGIS 資料庫.

執行：$env:TEST_DATABASE_URL="postgresql://..."; uv run pytest tests/test_queries_integration.py -v
"""

import os
import uuid

import asyncpg
import pytest

from app.db import queries
from app.services.carbon_calc import estimate_carbon
from app.services.geo_service import geometry_hash, polygon_area_ha

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")


def _poly(ring):
    return {"type": "Polygon", "coordinates": [ring]}


BASE = _poly([
    [121.752, 24.725], [121.756, 24.725], [121.756, 24.7206],
    [121.752, 24.7206], [121.752, 24.725],
])
# 與 BASE 部分重疊（右半邊平移）
OVERLAPPING = _poly([
    [121.754, 24.725], [121.758, 24.725], [121.758, 24.7206],
    [121.754, 24.7206], [121.754, 24.725],
])
# 相鄰但不相交（東側緊鄰）
ADJACENT = _poly([
    [121.7561, 24.725], [121.760, 24.725], [121.760, 24.7206],
    [121.7561, 24.7206], [121.7561, 24.725],
])


@pytest.fixture
async def db():
    """yield (conn, test_user)：asyncpg.Connection 有 __slots__，不能附加屬性."""
    c = await asyncpg.connect(TEST_DB)
    # Supabase auth.users 需要真實使用者才能滿足 FK；建立測試用假使用者
    test_user = uuid.uuid4()
    await c.execute(
        "insert into auth.users (id, email) values ($1, $2)",
        test_user, f"test-{test_user}@example.com",
    )
    yield c, test_user
    # 清理：刪測試資料（cascade 清 estimates）與測試使用者
    await c.execute("delete from forest_plots where owner_id = $1", test_user)
    await c.execute("delete from auth.users where id = $1", test_user)
    await c.close()


async def _insert(c, owner_id, geometry, name="測試林區"):
    area = polygon_area_ha(geometry)
    return await queries.insert_plot_with_estimates(
        c,
        owner_id=owner_id,
        name=name,
        species="taiwania",
        avg_age=15,
        density=1500,
        geometry=geometry,
        area_ha=area,
        geo_hash=geometry_hash(geometry),
        estimate=estimate_carbon("taiwania", 15, 1500, area),
    )


async def test_insert_writes_plot_and_six_estimates(db):
    conn, user = db
    plot = await _insert(conn, user, BASE)
    assert plot["status"] == "chain_pending"
    count = await conn.fetchval(
        "select count(*) from carbon_estimates where plot_id = $1", uuid.UUID(plot["id"])
    )
    assert count == 6


async def test_overlap_detected(db):
    conn, user = db
    await _insert(conn, user, BASE)
    conflicts = await queries.find_overlaps(conn, OVERLAPPING)
    assert len(conflicts) == 1
    assert conflicts[0]["overlap_ha"] > 0.001
    assert conflicts[0]["overlap_geojson"]["type"] in ("Polygon", "MultiPolygon")


async def test_adjacent_not_flagged(db):
    conn, user = db
    await _insert(conn, user, BASE)
    assert await queries.find_overlaps(conn, ADJACENT) == []


async def test_duplicate_geo_hash_raises_unique_violation(db):
    conn, user = db
    await _insert(conn, user, BASE)
    with pytest.raises(asyncpg.UniqueViolationError):
        await _insert(conn, user, BASE, name="重複幾何")


async def test_list_and_get(db):
    conn, user = db
    plot = await _insert(conn, user, BASE)
    plots = await queries.list_plots(conn)
    assert any(p["id"] == plot["id"] for p in plots)
    detail = await queries.get_plot(conn, uuid.UUID(plot["id"]))
    assert detail is not None
    assert len(detail["estimates"]) == 6
    assert detail["geometry"]["type"] == "Polygon"
    assert await queries.get_plot(conn, uuid.uuid4()) is None
