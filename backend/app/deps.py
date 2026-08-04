from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.models import ApiKey, User
from app.security import decode_token, verify_secret

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in.")
    if credentials is None:
        raise unauthorized
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("kind") != "access":
        raise unauthorized
    user = db.get(User, payload["sub"])
    if user is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_user_sse(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    token: str | None = None,
) -> User:
    """Same as get_current_user, but also accepts the token as a ?token=
    query param — EventSource (used for the invite-status SSE stream) can't
    set an Authorization header.

    Deliberately does NOT use the DbSession/get_db dependency: FastAPI keeps
    yield-based dependencies open for the whole request, and for a
    StreamingResponse "the whole request" means the entire connection
    lifetime — every open SSE tab would permanently hold a pooled DB
    connection. Opening and closing our own session here instead means the
    connection is returned to the pool immediately, before the stream even
    starts."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in.")
    raw = credentials.credentials if credentials else token
    if raw is None:
        raise unauthorized
    payload = decode_token(raw)
    if payload is None or payload.get("kind") != "access":
        raise unauthorized
    db = SessionLocal()
    try:
        user = db.get(User, payload["sub"])
    finally:
        db.close()
    if user is None:
        raise unauthorized
    return user


CurrentUserSSE = Annotated[User, Depends(get_current_user_sse)]


def get_current_api_key(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> ApiKey:
    """Authenticates a machine caller (an agent's own SDK, not a signed-in
    user) against a real API key created on the Developer page. Every
    active, unexpired key is bcrypt-checked in turn — there's no way to
    index a bcrypt hash for direct lookup, and an org's key count is small
    enough that this is cheap."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key.")
    if credentials is None:
        raise unauthorized
    raw = credentials.credentials
    now = datetime.now(UTC)
    candidates = db.scalars(select(ApiKey).where(ApiKey.status == "active")).all()
    for key in candidates:
        if key.expires_at is not None and key.expires_at < now:
            continue
        if verify_secret(raw, key.secret_hash):
            key.last_used_at = now
            db.commit()
            return key
    raise unauthorized


CurrentApiKey = Annotated[ApiKey, Depends(get_current_api_key)]


def require_agent_scope(api_key: ApiKey, agent_id: str) -> None:
    """An org-wide key (api_key.agent_id is None) may act as any agent in
    the org — an agent-scoped key may only ever act as the one agent it was
    issued for, never any other agent even in the same org."""
    if api_key.agent_id is not None and api_key.agent_id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This key isn't authorized for that agent."
        )
