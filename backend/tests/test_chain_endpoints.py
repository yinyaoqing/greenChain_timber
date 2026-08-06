import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.settings import get_settings
from app.db.pool import get_conn
from app.main import app


class FakeConn:
    """依 SQL 動詞/內容回應的假連線."""

    def __init__(self, rows: dict):
        self.rows = rows  # key: 片段字串 -> row/rows

    async def fetchrow(self, sql, *args):
        for key, val in self.rows.items():
            if key in sql:
                return val
        return None

    async def fetch(self, sql, *args):
        for key, val in self.rows.items():
            if key in sql:
                return val
        return []


def _client(rows, admin_token=""):
    async def fake_user():
        return uuid.uuid4()

    async def fake_conn():
        yield FakeConn(rows)

    if admin_token:
        import os

        os.environ["ADMIN_TOKEN"] = admin_token
        get_settings.cache_clear()
    app.dependency_overrides[get_current_user_id] = fake_user
    app.dependency_overrides[get_conn] = fake_conn
    return TestClient(app)


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()
    import os

    os.environ.pop("ADMIN_TOKEN", None)
    get_settings.cache_clear()


def test_chain_status_returns_status_and_chain_fields():
    plot_id = uuid.uuid4()
    rows = {"chain_records": {"status": "on_chain", "tx_hash": "0xabc", "token_id": 7}}
    with _client(rows) as c:
        resp = c.get(f"/api/forest/{plot_id}/chain-status")
    assert resp.status_code == 200
    assert resp.json() == {"status": "on_chain", "tx_hash": "0xabc", "token_id": 7}


def test_chain_status_404_unknown_plot():
    with _client({}) as c:
        assert c.get(f"/api/forest/{uuid.uuid4()}/chain-status").status_code == 404


def test_chain_status_requires_auth():
    with TestClient(app) as c:
        assert c.get(f"/api/forest/{uuid.uuid4()}/chain-status").status_code == 401


def test_admin_retry_403_without_token():
    with _client({}, admin_token="secret-token") as c:
        assert c.post("/api/admin/retry-pending").status_code == 403
        assert (
            c.post("/api/admin/retry-pending", headers={"X-Admin-Token": "wrong"}).status_code
            == 403
        )


def test_admin_retry_403_when_admin_token_unset():
    with _client({}) as c:  # settings.admin_token == ""
        assert (
            c.post("/api/admin/retry-pending", headers={"X-Admin-Token": ""}).status_code == 403
        )


def test_admin_retry_retriggers_pending():
    pending = [{"id": uuid.uuid4()}, {"id": uuid.uuid4()}]
    rows = {"chain_pending": pending}
    with _client(rows, admin_token="secret-token") as c:
        resp = c.post("/api/admin/retry-pending", headers={"X-Admin-Token": "secret-token"})
    assert resp.status_code == 200
    assert resp.json() == {"retriggered": 2}


def test_nft_metadata_public_no_auth():
    rows = {
        "token_id": {
            "name": "延文實驗林場 A 區",
            "species": "taiwania",
            "area_ha": 19.7204,
            "geo_hash": "ab" * 32,
            "co2e_tons": 357.3476,
            "token_id": 1,
        }
    }

    async def fake_conn():
        yield FakeConn(rows)

    app.dependency_overrides[get_conn] = fake_conn
    with TestClient(app) as c:
        resp = c.get("/api/nft/1/metadata")  # 無 Authorization header
    assert resp.status_code == 200
    body = resp.json()
    assert "延文實驗林場 A 區" in body["name"]
    assert isinstance(body["attributes"], list)


def test_nft_metadata_404():
    async def fake_conn():
        yield FakeConn({})

    app.dependency_overrides[get_conn] = fake_conn
    with TestClient(app) as c:
        assert c.get("/api/nft/999/metadata").status_code == 404
