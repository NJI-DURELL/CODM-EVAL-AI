import jwt
from fastapi import Header, HTTPException, status

from app.core.config import get_settings


def get_current_organizer_id(authorization: str | None = Header(default=None)) -> str:
    """Extract and verify the organizer's Supabase Auth JWT from the Authorization header.

    Returns the Supabase auth user id (`sub` claim), which is the value RLS
    policies compare against `organizer_id` on every table.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing subject claim")
    return sub
