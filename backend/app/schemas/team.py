from datetime import datetime

from app.schemas.base import CamelModel
from app.schemas.common import UserOut


class InvitationOut(CamelModel):
    id: str
    organization_id: str
    email: str
    role: str
    invited_by_user_id: str
    invited_at: datetime
    status: str
    email_status: str
    email_sent_at: datetime | None


class TeamOut(CamelModel):
    members: list[UserOut]
    invitations: list[InvitationOut]


class InviteMemberIn(CamelModel):
    email: str
    role: str


class UpdateMemberRoleIn(CamelModel):
    role: str


class PublicInvitationOut(CamelModel):
    email: str
    role: str
    organization_name: str


class AcceptInvitationIn(CamelModel):
    name: str
    username: str
    password: str
