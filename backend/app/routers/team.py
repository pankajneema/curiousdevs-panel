from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.ids import new_id
from app.models import CustomRole, Invitation, User
from app.roles import is_built_in_role
from app.routers.auth import EMAIL_PATTERN
from app.schemas.team import InviteMemberIn, InvitationOut, TeamOut, UpdateMemberRoleIn

router = APIRouter(prefix="/team", tags=["team"])


def _role_exists(db: DbSession, organization_id: str, role_id: str) -> bool:
    if is_built_in_role(role_id):
        return True
    custom = db.get(CustomRole, role_id)
    return bool(custom and custom.organization_id == organization_id)


def _is_last_owner(db: DbSession, organization_id: str, user_id: str) -> bool:
    owners = db.scalars(
        select(User.id).where(User.organization_id == organization_id, User.role == "owner")
    ).all()
    return len(owners) == 1 and owners[0] == user_id


@router.get("", response_model=TeamOut)
def list_team(current_user: CurrentUser, db: DbSession) -> TeamOut:
    members = db.scalars(select(User).where(User.organization_id == current_user.organization_id)).all()
    invitations = db.scalars(
        select(Invitation).where(
            Invitation.organization_id == current_user.organization_id,
            Invitation.status == "pending",
        )
    ).all()
    return TeamOut(members=list(members), invitations=list(invitations))


@router.post("/invite", response_model=InvitationOut)
def invite_member(payload: InviteMemberIn, current_user: CurrentUser, db: DbSession) -> InvitationOut:
    email = payload.email.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise api_error("Enter a valid email address.", "email")
    if db.scalar(select(User).where(User.email == email)):
        raise api_error("This person is already a member.", "email")
    if db.scalar(
        select(Invitation).where(
            Invitation.organization_id == current_user.organization_id,
            Invitation.email == email,
            Invitation.status == "pending",
        )
    ):
        raise api_error("An invitation is already pending for this email.", "email")
    if not _role_exists(db, current_user.organization_id, payload.role):
        raise api_error("Choose a valid role.", "role")

    invitation = Invitation(
        id=new_id("inv"),
        organization_id=current_user.organization_id,
        email=email,
        role=payload.role,
        invited_by_user_id=current_user.id,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


@router.post("/invitations/{invitation_id}/revoke", status_code=204)
def revoke_invitation(invitation_id: str, current_user: CurrentUser, db: DbSession) -> None:
    invitation = db.get(Invitation, invitation_id)
    if invitation and invitation.organization_id == current_user.organization_id:
        invitation.status = "revoked"
        db.commit()


@router.delete("/members/{user_id}", status_code=204)
def remove_member(user_id: str, current_user: CurrentUser, db: DbSession) -> None:
    if user_id == current_user.id:
        raise api_error("You cannot remove yourself. Transfer ownership first.")
    if _is_last_owner(db, current_user.organization_id, user_id):
        raise api_error("This is the only owner — promote someone else first.")
    member = db.get(User, user_id)
    if member and member.organization_id == current_user.organization_id:
        db.delete(member)
        db.commit()


@router.patch("/members/{user_id}/role", status_code=204)
def update_member_role(user_id: str, payload: UpdateMemberRoleIn, current_user: CurrentUser, db: DbSession) -> None:
    if not _role_exists(db, current_user.organization_id, payload.role):
        raise api_error("Choose a valid role.", "role")
    if payload.role != "owner" and _is_last_owner(db, current_user.organization_id, user_id):
        raise api_error("This is the only owner — promote someone else to Owner first.")
    member = db.get(User, user_id)
    if member and member.organization_id == current_user.organization_id:
        member.role = payload.role
        db.commit()
