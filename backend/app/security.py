import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

import bcrypt
import jwt

from app.config import settings


def hash_secret(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_secret(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


TokenKind = Literal["access", "pending_2fa"]


def create_token(subject: str, kind: TokenKind, minutes: int) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "kind": kind,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str) -> str:
    return create_token(user_id, "access", settings.access_token_expire_minutes)


def create_pending_2fa_token(user_id: str) -> str:
    return create_token(user_id, "pending_2fa", settings.pending_2fa_token_expire_minutes)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None


def generate_api_secret() -> tuple[str, str, str]:
    """Returns (full_secret, prefix_for_display, hash_to_store)."""
    raw = secrets.token_hex(20)
    full_secret = f"agtd_live_{raw}"
    prefix = f"agtd_live_{raw[:8]}…"
    return full_secret, prefix, hash_secret(full_secret)


def generate_recovery_codes(count: int = 10) -> list[str]:
    return [secrets.token_hex(4) for _ in range(count)]
