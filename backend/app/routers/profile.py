from sqlalchemy import select

from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import Organization, User
from app.routers.auth import EMAIL_PATTERN, USERNAME_PATTERN, _issue_session  # noqa: F401
from app.schemas.common import SessionOut
from app.schemas.profile import ChangePasswordIn, UpdateAvatarIn, UpdateOrganizationIn, UpdateProfileIn
from app.security import hash_secret, verify_secret

router = APIRouter(tags=["profile"])


@router.patch("/profile", response_model=SessionOut)
def update_profile(payload: UpdateProfileIn, current_user: CurrentUser, db: DbSession) -> SessionOut:
    if len(payload.name.strip()) < 1:
        raise api_error("Enter your name.", "name")

    username = payload.username.strip()
    if not USERNAME_PATTERN.match(username):
        raise api_error("3–32 characters: letters, numbers, dots, dashes or underscores.", "username")
    existing = db.scalar(select(User).where(User.username.ilike(username), User.id != current_user.id))
    if existing:
        raise api_error("That username is taken.", "username")

    current_user.name = payload.name.strip()
    current_user.username = username
    current_user.phone = payload.phone.strip() or None
    current_user.job_title = payload.job_title.strip() or None
    current_user.department = payload.department.strip() or None
    current_user.bio = payload.bio.strip() or None
    current_user.timezone = payload.timezone
    current_user.language = payload.language
    db.commit()
    db.refresh(current_user)
    return _issue_session(db, current_user)


@router.patch("/profile/avatar", response_model=SessionOut)
def update_avatar(payload: UpdateAvatarIn, current_user: CurrentUser, db: DbSession) -> SessionOut:
    current_user.avatar_url = payload.avatar_url
    db.commit()
    db.refresh(current_user)
    return _issue_session(db, current_user)


@router.post("/profile/password", status_code=204)
def change_password(payload: ChangePasswordIn, current_user: CurrentUser, db: DbSession) -> None:
    if len(payload.new_password) < 10:
        raise api_error("New password must be at least 10 characters.", "newPassword")
    if not verify_secret(payload.current_password, current_user.password_hash):
        raise api_error("Current password is incorrect.", "currentPassword")
    current_user.password_hash = hash_secret(payload.new_password)
    db.commit()


@router.patch("/organization", response_model=SessionOut)
def update_organization(payload: UpdateOrganizationIn, current_user: CurrentUser, db: DbSession) -> SessionOut:
    if len(payload.name.strip()) < 1:
        raise api_error("Enter an organization name.", "name")
    org = db.get(Organization, current_user.organization_id)
    org.name = payload.name.strip()
    db.commit()
    db.refresh(current_user)
    return _issue_session(db, current_user)
