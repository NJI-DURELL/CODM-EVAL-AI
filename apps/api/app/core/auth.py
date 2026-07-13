from functools import lru_cache

import jwt
from fastapi import Header, HTTPException, status

from app.core.config import get_settings


@lru_cache
def _get_jwks_client() -> jwt.PyJWKClient:
    """Supabase projects created with the newer asymmetric JWT Signing Keys
    sign access tokens with ES256, not the legacy HS256 shared secret.
    PyJWKClient fetches and caches the project's public keys and picks the
    right one by the token's `kid` header.
    """
    settings = get_settings()
    return jwt.PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def get_current_organizer_id(authorization: str | None = Header(default=None)) -> str:
    """Extract and verify the organizer's Supabase Auth JWT from the Authorization header.

    Returns the Supabase auth user id (`sub` claim), which is the value RLS
    policies compare against `organizer_id` on every table.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            # Legacy projects: a static shared secret signs the token.
            key = get_settings().supabase_jwt_secret
        else:
            # Current projects: an asymmetric key (ES256/RS256) signs the
            # token; verify against the project's published public key.
            key = _get_jwks_client().get_signing_key_from_jwt(token).key
        payload = jwt.decode(
            token, key, algorithms=["HS256", "ES256", "RS256"], audience="authenticated"
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing subject claim")
    return sub
