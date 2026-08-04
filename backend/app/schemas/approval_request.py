from datetime import datetime

from app.schemas.base import CamelModel


class ApprovalRequestOut(CamelModel):
    id: str
    agent_id: str
    agent_name: str
    action_summary: str
    context: str
    # Computed at read time: a still-"pending" row past its expires_at is
    # shown as "expired" without needing a scheduled job to flip a stored
    # value — see approval_requests.py's request_to_out.
    status: str
    requested_at: datetime
    expires_at: datetime | None
    decided_by_user_id: str | None
    decided_by_name: str | None
    decided_at: datetime | None
    decision_reason: str | None


class CreateApprovalRequestIn(CamelModel):
    action_summary: str
    context: str = ""
    expires_at: datetime | None = None


class DecideApprovalRequestIn(CamelModel):
    decision: str  # "approved" | "denied"
    reason: str | None = None
