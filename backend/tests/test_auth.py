import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id

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
