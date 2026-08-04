import asyncio
import json
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.audit import record
from app.config import settings
from app.db import SessionLocal
from app.deps import CurrentUser, CurrentUserSSE, DbSession
from app.email import build_invitation_email, send_email
from app.errors import api_error
from app.events import subscribe, unsubscribe, publish
from app.ids import new_id
from app.models import CustomRole, Invitation, Organization, User
from app.roles import BUILT_IN_ROLES, is_built_in_role
from app.routers.auth import EMAIL_PATTERN
from app.schemas.team import InviteMemberIn, InvitationOut, TeamOut, UpdateMemberRoleIn

router = APIRouter(prefix="/team", tags=["team"])


def _role_exists(db: DbSession, organization_id: str, role_id: str) -> bool:
    if is_built_in_role(role_id):
        return True
    custom = db.get(CustomRole, role_id)
    return bool(custom and custom.organization_id == organization_id)


def _role_label(db, organization_id: str, role_id: str) -> str:
    built_in = next((r["name"] for r in BUILT_IN_ROLES if r["id"] == role_id), None)
    if built_in:
        return built_in
    custom = db.get(CustomRole, role_id)
    return custom.name if custom and custom.organization_id == organization_id else role_id


def _send_invite_email_blocking(invitation_id: str, organization_id: str) -> tuple[str, str] | None:
    """All blocking I/O (DB + SMTP) in one call, so it can run as a single
    unit in a worker thread. Opens its own DB session since the request's
    session is closed by the time a background task runs. Returns
    (invitation_id, email_status), or None if the invitation vanished."""
    db = SessionLocal()
    try:
        invitation = db.get(Invitation, invitation_id)
        if invitation is None:
            return None
        org = db.get(Organization, organization_id)
        inviter = db.get(User, invitation.invited_by_user_id)
        role_label = _role_label(db, organization_id, invitation.role)
        accept_url = f"{settings.frontend_url}/accept-invite?token={invitation.token}"
        subject, html_body, text_body = build_invitation_email(
            inviter.name if inviter else "A teammate", org.name if org else "your team", role_label, accept_url
        )

        try:
            send_email(invitation.email, subject, html_body, text_body)
            invitation.email_status = "sent"
            invitation.email_sent_at = datetime.now(UTC)
        except Exception:
            invitation.email_status = "failed"
        db.commit()
        return invitation.id, invitation.email_status
    finally:
        db.close()


async def _send_invite_email(invitation_id: str, organization_id: str) -> None:
    """Runs after the /team/invite response has already been sent, so
    inviting someone never waits on SMTP latency. The blocking DB/SMTP work
    runs in a thread (run_in_threadpool) so it never freezes the event loop;
    publish() below runs back on the loop, since asyncio.Queue isn't
    thread-safe to touch directly from a worker thread."""
    result = await run_in_threadpool(_send_invite_email_blocking, invitation_id, organization_id)
    if result is None:
        return
    invitation_id, status = result
    publish(organization_id, {"type": "invitation.email_status", "invitationId": invitation_id, "status": status})


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
def invite_member(
    payload: InviteMemberIn, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks
) -> InvitationOut:
    email = payload.email.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise api_error("Enter a valid email address.", "email")
    if payload.role == "owner":
        raise api_error("The owner role can't be assigned by invite — there's only ever one owner.", "role")
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
    record(db, current_user, "team.member_invited", "invitation", invitation.id, email, f"Invited {email} as {payload.role}")
    db.commit()
    db.refresh(invitation)

    # Queued for after this response is sent — inviting someone returns
    # immediately instead of waiting on SMTP round-trip latency.
    background_tasks.add_task(_send_invite_email, invitation.id, current_user.organization_id)

    return invitation


@router.get("/events")
async def team_events(current_user: CurrentUserSSE, request: Request):
    queue = subscribe(current_user.organization_id)

    async def stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            unsubscribe(current_user.organization_id, queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/invitations/{invitation_id}/revoke", status_code=204)
def revoke_invitation(invitation_id: str, current_user: CurrentUser, db: DbSession) -> None:
    invitation = db.get(Invitation, invitation_id)
    if invitation and invitation.organization_id == current_user.organization_id:
        invitation.status = "revoked"
        record(
            db, current_user, "team.invitation_revoked", "invitation", invitation.id, invitation.email,
            f"Revoked the pending invitation for {invitation.email}",
        )
        db.commit()


@router.delete("/members/{user_id}", status_code=204)
def remove_member(user_id: str, current_user: CurrentUser, db: DbSession) -> None:
    if user_id == current_user.id:
        raise api_error("You cannot remove yourself.")
    if _is_last_owner(db, current_user.organization_id, user_id):
        raise api_error("The owner can't be removed.")
    member = db.get(User, user_id)
    if member and member.organization_id == current_user.organization_id:
        record(db, current_user, "team.member_removed", "user", member.id, member.name, f"Removed {member.name} from the team")
        db.delete(member)
        db.commit()


@router.patch("/members/{user_id}/role", status_code=204)
def update_member_role(user_id: str, payload: UpdateMemberRoleIn, current_user: CurrentUser, db: DbSession) -> None:
    if payload.role == "owner":
        raise api_error("Ownership can't be transferred this way — there's only ever one owner.", "role")
    if not _role_exists(db, current_user.organization_id, payload.role):
        raise api_error("Choose a valid role.", "role")
    if _is_last_owner(db, current_user.organization_id, user_id):
        raise api_error("The owner's role can't be changed.")
    member = db.get(User, user_id)
    if member and member.organization_id == current_user.organization_id:
        old_role = member.role
        member.role = payload.role
        record(
            db, current_user, "team.member_role_changed", "user", member.id, member.name,
            f"Changed {member.name}'s role from {old_role} to {payload.role}",
        )
        db.commit()
