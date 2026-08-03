import re
from datetime import UTC, datetime, timedelta

import pyotp
from fastapi import APIRouter, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.bootstrap import seed_organization, seed_user_defaults
from app.config import settings
from app.db import get_db
from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.ids import new_id
from app.models import LoginEvent, Organization, TwoFactorCredential, User
from app.schemas.auth import LoginIn, LoginResult, RegisterIn, VerifyTwoFactorIn
from app.schemas.common import SessionOut
from app.security import create_access_token, create_pending_2fa_token, decode_token, hash_secret, verify_secret

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
USERNAME_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$", re.IGNORECASE)


def _issue_session(db: Session, user: User) -> SessionOut:
    org = db.get(Organization, user.organization_id)
    token = create_access_token(user.id)
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return SessionOut.model_validate({"token": token, "user": user, "organization": org, "expires_at": expires_at})


def _record_login(db: Session, user: User, request: Request) -> None:
    user.last_active_at = datetime.now(UTC)
    db.add(LoginEvent(user_id=user.id, user_agent=request.headers.get("user-agent", "unknown")))


@router.post("/register", response_model=SessionOut)
def register(payload: RegisterIn, request: Request, db: DbSession) -> SessionOut:
    email = payload.email.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise api_error("Enter a valid email address.", "email")
    if db.scalar(select(User).where(User.email == email)):
        raise api_error("An account with this email already exists.", "email")

    username = payload.username.strip()
    if not USERNAME_PATTERN.match(username):
        raise api_error("3–32 characters: letters, numbers, dots, dashes or underscores.", "username")
    if db.scalar(select(User).where(User.username.ilike(username))):
        raise api_error("That username is taken.", "username")

    if len(payload.password) < 10:
        raise api_error("Password must be at least 10 characters.", "password")
    if len(payload.name.strip()) < 1:
        raise api_error("Enter your name.", "name")
    if len(payload.organization_name.strip()) < 1:
        raise api_error("Enter your organization's name.", "organizationName")

    domain = email.split("@")[-1]
    org = Organization(name=payload.organization_name.strip(), domain=domain)
    db.add(org)
    db.flush()

    user = User(
        id=new_id("usr"),
        organization_id=org.id,
        name=payload.name.strip(),
        username=username,
        email=email,
        password_hash=hash_secret(payload.password),
        role="owner",
    )
    db.add(user)
    db.flush()

    seed_organization(db, org.id)
    seed_user_defaults(db, user.id)
    _record_login(db, user, request)

    db.commit()
    db.refresh(user)
    return _issue_session(db, user)


@router.post("/login", response_model=LoginResult)
def login(payload: LoginIn, request: Request, db: DbSession) -> LoginResult:
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    # Deliberately the same error for "no such user" and "wrong password" --
    # distinguishing them lets an attacker enumerate accounts.
    if not user or not verify_secret(payload.password, user.password_hash):
        raise api_error("Incorrect email or password.")

    two_factor = db.get(TwoFactorCredential, user.id)
    if two_factor and two_factor.enabled:
        return LoginResult(requires_two_factor=True, pending_token=create_pending_2fa_token(user.id))

    _record_login(db, user, request)
    db.commit()
    db.refresh(user)
    return LoginResult(requires_two_factor=False, session=_issue_session(db, user))


@router.post("/login/verify-2fa", response_model=SessionOut)
def verify_two_factor_login(payload: VerifyTwoFactorIn, request: Request, db: DbSession) -> SessionOut:
    claims = decode_token(payload.pending_token)
    if claims is None or claims.get("kind") != "pending_2fa":
        raise api_error("That confirmation has expired. Sign in again.")

    user = db.get(User, claims["sub"])
    two_factor = db.get(TwoFactorCredential, claims["sub"]) if user else None
    if not user or not two_factor or not two_factor.enabled:
        raise api_error("That confirmation has expired. Sign in again.")

    totp = pyotp.TOTP(two_factor.secret)
    if not totp.verify(payload.code, valid_window=1):
        raise api_error("That code didn't match. Try again.", "code")

    _record_login(db, user, request)
    db.commit()
    db.refresh(user)
    return _issue_session(db, user)


@router.get("/me", response_model=SessionOut)
def me(current_user: CurrentUser, db: DbSession) -> SessionOut:
    return _issue_session(db, current_user)
