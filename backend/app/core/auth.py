"""Supabase JWT 驗證（FR-1.3）：依 alg 分派 ES256(JWKS) / HS256(共用密鑰)."""

import uuid
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.settings import get_settings

_bearer = HTTPBearer(auto_error=False)


@lru_cache
def _get_jwk_client(jwks_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_url)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> uuid.UUID:
    if credentials is None:
        raise HTTPException(status_code=401, detail="missing bearer token")

    token = credentials.credentials
    settings = get_settings()

    try:
        alg = jwt.get_unverified_header(token).get("alg")

        if alg == "ES256":
            if not settings.supabase_url:
                raise HTTPException(status_code=401, detail="invalid token")
            jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
            signing_key = _get_jwk_client(jwks_url).get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        elif alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise HTTPException(status_code=401, detail="invalid token")
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            raise HTTPException(status_code=401, detail="invalid token")

        return uuid.UUID(payload["sub"])
    except HTTPException:
        raise
    except (jwt.InvalidTokenError, jwt.PyJWKClientError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="invalid token") from exc
