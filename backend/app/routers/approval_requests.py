from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import select

from app.audit import record
from app.deps import CurrentApiKey, CurrentUser, DbSession, require_agent_scope
from app.errors import api_error
from app.events import publish
from app.models import Agent, ApprovalRequest, User
from app.schemas.approval_request import ApprovalRequestOut, CreateApprovalRequestIn, DecideApprovalRequestIn

router = APIRouter(tags=["approval-requests"])

DECISIONS = {"approved", "denied"}


def _effective_status(request: ApprovalRequest) -> str:
    if request.status == "pending" and request.expires_at and request.expires_at < datetime.now(UTC):
        return "expired"
    return request.status


def request_to_out(db: DbSession, request: ApprovalRequest, agent: Agent | None = None) -> ApprovalRequestOut:
    agent = agent or db.get(Agent, request.agent_id)
    decider = db.get(User, request.decided_by_user_id) if request.decided_by_user_id else None
    return ApprovalRequestOut(
        id=request.id,
        agent_id=request.agent_id,
        agent_name=agent.name if agent else "Unknown agent",
        action_summary=request.action_summary,
        context=request.context,
        status=_effective_status(request),
        requested_at=request.requested_at,
        expires_at=request.expires_at,
        decided_by_user_id=request.decided_by_user_id,
        decided_by_name=decider.name if decider else None,
        decided_at=request.decided_at,
        decision_reason=request.decision_reason,
    )


@router.post("/agents/{agent_id}/approval-requests", response_model=ApprovalRequestOut, tags=["agents"])
def create_approval_request(
    agent_id: str, payload: CreateApprovalRequestIn, api_key: CurrentApiKey, db: DbSession
) -> ApprovalRequestOut:
    """What an agent's own SDK calls, using its real API key, when it wants
    to do something above its normal authority and needs a human to say
    yes first."""
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != api_key.organization_id:
        raise api_error("Agent not found.", status_code=404)
    require_agent_scope(api_key, agent_id)

    summary = payload.action_summary.strip()
    if len(summary) < 1:
        raise api_error("Describe what needs approval.", "actionSummary")

    request = ApprovalRequest(
        organization_id=agent.organization_id,
        agent_id=agent.id,
        action_summary=summary,
        context=payload.context.strip(),
        expires_at=payload.expires_at,
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    publish(agent.organization_id, {"type": "approval_request.status", "approvalRequestId": request.id, "status": "pending"})

    return request_to_out(db, request, agent)


@router.get("/agents/{agent_id}/approval-requests/{request_id}", response_model=ApprovalRequestOut, tags=["agents"])
def get_agent_approval_request(agent_id: str, request_id: str, api_key: CurrentApiKey, db: DbSession) -> ApprovalRequestOut:
    """What an agent polls to find out whether a human has decided yet."""
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != api_key.organization_id:
        raise api_error("Agent not found.", status_code=404)
    require_agent_scope(api_key, agent_id)
    request = db.get(ApprovalRequest, request_id)
    if not request or request.agent_id != agent_id:
        raise api_error("Approval request not found.", status_code=404)
    return request_to_out(db, request, agent)


@router.get("/approval-requests", response_model=list[ApprovalRequestOut])
def list_approval_requests(current_user: CurrentUser, db: DbSession, status: str | None = None) -> list[ApprovalRequestOut]:
    requests = db.scalars(
        select(ApprovalRequest)
        .where(ApprovalRequest.organization_id == current_user.organization_id)
        .order_by(ApprovalRequest.requested_at.desc())
    ).all()
    out = [request_to_out(db, r) for r in requests]
    if status:
        out = [r for r in out if r.status == status]
    return out


@router.post("/approval-requests/{request_id}/decide", response_model=ApprovalRequestOut)
def decide_approval_request(
    request_id: str, payload: DecideApprovalRequestIn, current_user: CurrentUser, db: DbSession
) -> ApprovalRequestOut:
    request = db.get(ApprovalRequest, request_id)
    if not request or request.organization_id != current_user.organization_id:
        raise api_error("Approval request not found.", status_code=404)
    if payload.decision not in DECISIONS:
        raise api_error("Choose approved or denied.", "decision")
    if _effective_status(request) != "pending":
        raise api_error("This request has already been decided, or has expired.")

    request.status = payload.decision
    request.decided_by_user_id = current_user.id
    request.decided_at = datetime.now(UTC)
    request.decision_reason = payload.reason.strip() if payload.reason else None

    agent = db.get(Agent, request.agent_id)
    record(
        db,
        current_user,
        f"approval_request.{payload.decision}",
        "approval_request",
        request.id,
        request.action_summary,
        f"{payload.decision.capitalize()} “{request.action_summary}” for {agent.name if agent else 'an agent'}",
    )
    db.commit()
    db.refresh(request)

    publish(
        request.organization_id,
        {"type": "approval_request.status", "approvalRequestId": request.id, "status": request.status},
    )

    return request_to_out(db, request, agent)
