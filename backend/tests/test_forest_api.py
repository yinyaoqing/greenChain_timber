import uuid

import pytest
from fastapi.testclient import TestClient

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


@pytest.fixture
def client():
    async def fake_user():
        return uuid.uuid4()

    async def fail_conn():
        raise AssertionError("此測試不應觸及資料庫")
        yield  # pragma: no cover

    app.dependency_overrides[get_current_user_id] = fake_user
    app.dependency_overrides[get_conn] = fail_conn
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_post_without_token_returns_401():
    with TestClient(app) as c:
        assert c.post("/api/forest", json=VALID_BODY).status_code == 401


def test_age_out_of_range_422(client):
    body = {**VALID_BODY, "avg_age": 0}
    assert client.post("/api/forest", json=body).status_code == 422


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
