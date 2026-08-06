from fastapi.testclient import TestClient

from app.main import app


def test_healthz_returns_ok_even_without_db():
    with TestClient(app) as client:
        resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "down"  # conftest 指向無效 DB
