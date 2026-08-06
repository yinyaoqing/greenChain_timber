import datetime
import uuid

import pytest
from fastapi.testclient import TestClient

import app.routers.forest as forest_router
from app.core.auth import get_current_user_id
from app.db.pool import get_conn
from app.main import app

VALID_BODY = {
    "name": "延文實驗林場 A 區",
    "species": "taiwania",
    "avg_age": 15,
    "density": 1500,
    "geometry": {
        "type": "Polygon",
        "coordinates": [[
            [121.752, 24.725], [121.756, 24.725], [121.756, 24.7206],
            [121.752, 24.7206], [121.752, 24.725],
        ]],
    },
}


class _ForbiddenConn:
    """任何屬性存取即失敗——保證驗證失敗路徑不使用資料庫."""

    def __getattr__(self, name):
        raise AssertionError(f"此測試不應觸及資料庫（嘗試存取 conn.{name}）")


@pytest.fixture
def client():
    async def fake_user():
        return uuid.uuid4()

    async def spy_conn():
        yield _ForbiddenConn()

    app.dependency_overrides[get_current_user_id] = fake_user
    app.dependency_overrides[get_conn] = spy_conn
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_post_without_token_returns_401():
    with TestClient(app) as c:
        assert c.post("/api/forest", json=VALID_BODY).status_code == 401


def test_age_out_of_range_422(client):
    body = {**VALID_BODY, "avg_age": 0}
    resp = client.post("/api/forest", json=body)
    assert resp.status_code == 422
    payload = resp.json()
    assert isinstance(payload["detail"], list)
    assert "loc" in payload["detail"][0]
    assert "msg" in payload["detail"][0]


def test_density_out_of_range_422(client):
    body = {**VALID_BODY, "density": 50}
    assert client.post("/api/forest", json=body).status_code == 422


def test_invalid_species_422(client):
    body = {**VALID_BODY, "species": "bamboo"}
    assert client.post("/api/forest", json=body).status_code == 422


def test_self_intersecting_geometry_422(client):
    body = {
        **VALID_BODY,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [121.752, 24.725], [121.756, 24.721], [121.756, 24.725],
                [121.752, 24.721], [121.752, 24.725],
            ]],
        },
    }
    resp = client.post("/api/forest", json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "self_intersection"


def test_outside_taiwan_422(client):
    body = {
        **VALID_BODY,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [139.69, 35.68], [139.70, 35.68], [139.70, 35.69],
                [139.69, 35.69], [139.69, 35.68],
            ]],
        },
    }
    resp = client.post("/api/forest", json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "out_of_taiwan_bbox"


def test_malformed_ragged_coordinates_422(client):
    body = {
        **VALID_BODY,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [121.752, 24.725], [121.756], [121.756, 24.7206],
                [121.752, 24.7206], [121.752, 24.725],
            ]],
        },
    }
    resp = client.post("/api/forest", json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "invalid_type"


def test_area_too_small_422(client):
    # 約 0.01 ha 的微小多邊形（< 0.1 ha 下限）
    body = {
        **VALID_BODY,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [121.752, 24.725], [121.75210, 24.725], [121.75210, 24.72510],
                [121.752, 24.72510], [121.752, 24.725],
            ]],
        },
    }
    resp = client.post("/api/forest", json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "area_out_of_range"


def test_submit_schedules_mint_background_task(client, monkeypatch):
    fake_plot_id = str(uuid.uuid4())
    fake_plot = {
        "id": fake_plot_id,
        "area_ha": 1.2345,
        "status": "chain_pending",
        "created_at": datetime.datetime.now(datetime.UTC).isoformat(),
    }

    async def fake_find_overlaps(conn, geometry):
        return []

    async def fake_insert_plot_with_estimates(conn, **kwargs):
        return fake_plot

    calls = []

    async def fake_mint_and_record(pool, plot_id):
        calls.append(plot_id)

    monkeypatch.setattr(forest_router.queries, "find_overlaps", fake_find_overlaps)
    monkeypatch.setattr(
        forest_router.queries, "insert_plot_with_estimates", fake_insert_plot_with_estimates
    )
    monkeypatch.setattr(forest_router, "mint_and_record", fake_mint_and_record)

    resp = client.post("/api/forest", json=VALID_BODY)

    assert resp.status_code == 201
    assert calls == [uuid.UUID(fake_plot_id)]


def test_openapi_includes_body_schema():
    with TestClient(app) as c:
        spec = c.get("/openapi.json").json()

    post_op = spec["paths"]["/api/forest"]["post"]
    body_schema = post_op["requestBody"]["content"]["application/json"]["schema"]
    ref = body_schema.get("$ref", "")
    assert "ForestSubmission" in ref
    assert "ForestSubmission" in spec["components"]["schemas"]
