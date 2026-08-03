from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import Agent
from app.schemas.agent import AgentOut

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentOut])
def list_agents(current_user: CurrentUser, db: DbSession) -> list[AgentOut]:
    return list(db.scalars(select(Agent).where(Agent.organization_id == current_user.organization_id)).all())
