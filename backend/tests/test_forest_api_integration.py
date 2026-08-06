"""API 整合測試：201 成功與 409 重疊，走真實 DB（TEST_DATABASE_URL）."""

import os
import uuid

import asyncpg
import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.main import app

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")

RING_A = [
    [121.762, 24.735], [121.766, 24.735], [121.766, 24.7306],
    [121.762, 24.7306], [121.762, 24.735],
]
RING_A_OVERLAP = [
    [121.764, 24.735], [121.768, 24.735], [121.768, 24.7306],
    [121.764, 24.7306], [121.764, 24.735],
]


def _body(ring, name):
    return {
        "name": name,
        "species": "taiwania",
        "avg_age": 15,
        "density": 1500,
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


@pytest.fixture
def client_with_user():
    test_user = uuid.uuid4()

    async def fake_user():
        return test_user

    app.dependency_overrides[get_current_user_id] = fake_user
    # 整合測試用真實 pool：把 app 的 DATABASE_URL 換成 TEST_DATABASE_URL
    os.environ["DATABASE_URL"] = TEST_DB
    from app.core.settings import get_settings

    get_settings.cache_clear()

    import asyncio

    async def _setup():
        c = await asyncpg.connect(TEST_DB)
        await c.execute(
            "insert into auth.users (id, email) values ($1, $2)",
            test_user, f"test-{test_user}@example.com",
        )
        await c.close()

    asyncio.run(_setup())

    with TestClient(app) as c:
        yield c

    async def _teardown():
        c = await asyncpg.connect(TEST_DB)
        await c.execute("delete from forest_plots where owner_id = $1", test_user)
        await c.execute("delete from auth.users where id = $1", test_user)
        await c.close()

    asyncio.run(_teardown())
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def test_full_submit_then_overlap_409(client_with_user):
    c = client_with_user
    # 201：完整申報
    resp = c.post("/api/forest", json=_body(RING_A, "整合測試 A 區"))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["plot"]["status"] == "chain_pending"
    assert len(body["estimates"]) == 6
    assert body["chain"]["status"] == "pending"
    plot_id = body["plot"]["id"]

    # 409：重疊提交
    resp2 = c.post("/api/forest", json=_body(RING_A_OVERLAP, "重疊區"))
    assert resp2.status_code == 409
    conflicts = resp2.json()["detail"]["conflicts"]
    assert conflicts[0]["plot_id"] == plot_id
    assert conflicts[0]["overlap_ha"] > 0.001

    # GET 清單與詳情
    plots = c.get("/api/forest").json()
    assert any(p["id"] == plot_id for p in plots)
    detail = c.get(f"/api/forest/{plot_id}").json()
    assert detail["name"] == "整合測試 A 區"
    assert len(detail["estimates"]) == 6

    # 404
    assert c.get(f"/api/forest/{uuid.uuid4()}").status_code == 404
