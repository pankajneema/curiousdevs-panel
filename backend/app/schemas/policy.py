from datetime import datetime

from app.schemas.base import CamelModel


class PolicyOut(CamelModel):
    id: str
    organization_id: str
    name: str
    description: str
    status: str
    attached_agent_count: int
    created_at: datetime


class CreatePolicyIn(CamelModel):
    name: str
    description: str = ""
    status: str = "draft"


class UpdatePolicyIn(CamelModel):
    name: str
    description: str
    status: str
