from datetime import datetime

from app.schemas.base import CamelModel


class GroupOut(CamelModel):
    id: str
    organization_id: str
    name: str
    member_user_ids: list[str]
    created_at: datetime


class CreateGroupIn(CamelModel):
    name: str


class UpdateGroupMembersIn(CamelModel):
    member_user_ids: list[str]
