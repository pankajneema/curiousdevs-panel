from fastapi import APIRouter, Request
from sqlalchemy import select

from app.bootstrap import seed_user_defaults
from app.deps import DbSession
from app.errors import api_error
from app.ids import new_id
from app.models import Invitation, Organization, User
from app.routers.auth import USERNAME_PATTERN, _issue_session, _record_login
from app.schemas.common import SessionOut
from app.schemas.team import AcceptInvitationIn, PublicInvitationOut
from app.security import hash_secret

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _get_pending_invitation(db: DbSession, token: str) -> Invitation:
    invitation = db.scalar(select(Invitation).where(Invitation.token == token))
    if invitation is None or invitation.status != "pending":
        raise api_error("This invitation link is no longer valid.", status_code=404)
    return invitation


@router.get("/{token}", response_model=PublicInvitationOut)
def get_invitation(token: str, db: DbSession) -> PublicInvitationOut:
    invitation = _get_pending_invitation(db, token)
    org = db.get(Organization, invitation.organization_id)
    return PublicInvitationOut(
        email=invitation.email,
        role=invitation.role,
        organization_name=org.name if org else "",
    )


@router.post("/{token}/accept", response_model=SessionOut)
def accept_invitation(token: str, payload: AcceptInvitationIn, request: Request, db: DbSession) -> SessionOut:
    invitation = _get_pending_invitation(db, token)

    username = payload.username.strip()
    if not USERNAME_PATTERN.match(username):
        raise api_error("3–32 characters: letters, numbers, dots, dashes or underscores.", "username")
    if db.scalar(select(User).where(User.username.ilike(username))):
        raise api_error("That username is taken.", "username")
    if len(payload.password) < 10:
        raise api_error("Password must be at least 10 characters.", "password")
    if len(payload.name.strip()) < 1:
        raise api_error("Enter your name.", "name")

    user = User(
        id=new_id("usr"),
        organization_id=invitation.organization_id,
        name=payload.name.strip(),
        username=username,
        email=invitation.email,
        password_hash=hash_secret(payload.password),
        role=invitation.role,
    )
    db.add(user)
    db.flush()

    seed_user_defaults(db, user.id)
    invitation.status = "accepted"
    _record_login(db, user, request)

    db.commit()
    db.refresh(user)
    return _issue_session(db, user)
