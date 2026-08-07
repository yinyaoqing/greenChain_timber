"""CORS 白名單：明列 origin + regex（涵蓋 Vercel Preview 部署網域）."""

from fastapi.testclient import TestClient

from app.main import app


def _preflight(client: TestClient, origin: str):
    return client.options(
        "/api/forest",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )


def test_listed_origin_allowed():
    with TestClient(app) as client:
        resp = _preflight(client, "http://localhost:3000")
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_vercel_preview_origin_allowed_by_regex():
    origin = "https://green-chain-timber-abc123-josephs-projects.vercel.app"
    with TestClient(app) as client:
        resp = _preflight(client, origin)
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == origin


def test_unknown_origin_rejected():
    with TestClient(app) as client:
        resp = _preflight(client, "https://evil.example.com")
    assert resp.status_code == 400
    assert "access-control-allow-origin" not in resp.headers
