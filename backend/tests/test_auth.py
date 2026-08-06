import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

import app.core.auth as auth_module
from app.core.auth import get_current_user_id
from app.core.settings import get_settings

SECRET = "test-secret-0123456789abcdefghijklmnopqrstuvwxyz"  # match conftest.py
USER_ID = str(uuid.uuid4())


def _token(secret=SECRET, aud="authenticated", sub=USER_ID, expired=False):
    exp = datetime.now(UTC) + (timedelta(hours=-1) if expired else timedelta(hours=1))
    return jwt.encode({"sub": sub, "aud": aud, "exp": exp}, secret, algorithm="HS256")


@pytest.fixture
def client():
    app = FastAPI()

    @app.get("/whoami")
    async def whoami(user_id: uuid.UUID = Depends(get_current_user_id)):
        return {"user_id": str(user_id)}

    return TestClient(app)


def test_valid_token_returns_user_id(client):
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {_token()}"})
    assert resp.status_code == 200
    assert resp.json()["user_id"] == USER_ID


def test_missing_token_401(client):
    assert client.get("/whoami").status_code == 401


def test_wrong_secret_401(client):
    resp = client.get(
        "/whoami", headers={"Authorization": f"Bearer {_token(secret='wrong')}"}
    )
    assert resp.status_code == 401


def test_expired_token_401(client):
    resp = client.get(
        "/whoami", headers={"Authorization": f"Bearer {_token(expired=True)}"}
    )
    assert resp.status_code == 401


def test_wrong_audience_401(client):
    resp = client.get(
        "/whoami", headers={"Authorization": f"Bearer {_token(aud='anon')}"}
    )
    assert resp.status_code == 401


def _es256_token(private_key, aud="authenticated", sub=USER_ID, expired=False, kid="test-kid"):
    exp = datetime.now(UTC) + (timedelta(hours=-1) if expired else timedelta(hours=1))
    return jwt.encode(
        {"sub": sub, "aud": aud, "exp": exp},
        private_key,
        algorithm="ES256",
        headers={"kid": kid},
    )


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


def test_es256_token_valid(client, monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(
        auth_module.jwt.PyJWKClient,
        "get_signing_key_from_jwt",
        lambda self, token: _FakeSigningKey(public_key),
    )

    try:
        token = _es256_token(private_key)
        resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["user_id"] == USER_ID
    finally:
        get_settings.cache_clear()


def test_es256_wrong_key_401(client, monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    other_key = ec.generate_private_key(ec.SECP256R1())
    other_public_key = other_key.public_key()

    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(
        auth_module.jwt.PyJWKClient,
        "get_signing_key_from_jwt",
        lambda self, token: _FakeSigningKey(other_public_key),
    )

    try:
        token = _es256_token(private_key)
        resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
    finally:
        get_settings.cache_clear()


def test_unsupported_alg_401(client):
    token = jwt.encode(
        {"sub": USER_ID, "aud": "authenticated"},
        "some-secret",
        algorithm="HS384",
    )
    resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_es256_disabled_when_no_supabase_url(client, monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())

    get_settings.cache_clear()
    monkeypatch.setenv("SUPABASE_URL", "")

    try:
        token = _es256_token(private_key)
        resp = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
    finally:
        get_settings.cache_clear()
