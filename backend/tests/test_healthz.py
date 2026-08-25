from fastapi.testclient import TestClient

from app.main import app


def test_healthz_returns_ok_even_without_db():
    with TestClient(app) as client:
        resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "down"  # conftest 指向無效 DB


def test_healthz_exposes_build_info():
    """線上可用 /healthz 判斷實際部署版本；本機未注入 RENDER_GIT_COMMIT 時回 local"""
    with TestClient(app) as client:
        body = client.get("/healthz").json()
    assert body["version"] == "local"
    assert body["started_at"] is not None
