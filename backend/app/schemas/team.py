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


class TeamOut(CamelModel):
    members: list[UserOut]
    invitations: list[InvitationOut]


class InviteMemberIn(CamelModel):
    email: str
    role: str


class UpdateMemberRoleIn(CamelModel):
    role: str
