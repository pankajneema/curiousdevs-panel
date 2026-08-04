from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import Agent, AgentCallEvent
from app.schemas.monitoring import MonitoringAgentRow, MonitoringHourlyBucket, MonitoringOverviewOut

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/overview", response_model=MonitoringOverviewOut)
def get_monitoring_overview(current_user: CurrentUser, db: DbSession) -> MonitoringOverviewOut:
    """Every number here comes straight from AgentCallEvent rows an agent
    itself reported (POST /agents/{id}/activity) — an org with no agents
    reporting in gets real zeros, not a placeholder chart."""
    since = datetime.now(UTC) - timedelta(hours=24)

    agents = db.scalars(
        select(Agent).where(Agent.organization_id == current_user.organization_id, Agent.status != "decommissioned")
    ).all()

    rows = db.execute(
        select(AgentCallEvent.agent_id, func.sum(AgentCallEvent.count))
        .where(AgentCallEvent.organization_id == current_user.organization_id, AgentCallEvent.occurred_at >= since)
        .group_by(AgentCallEvent.agent_id)
    ).all()
    volume_by_agent: dict[str, int] = {agent_id: int(total) for agent_id, total in rows}

    agent_rows = [
        MonitoringAgentRow(
            agent_id=a.id,
            agent_name=a.name,
            environment=a.environment,
            status=a.status,
            call_volume_24h=volume_by_agent.get(a.id, 0),
            last_seen_at=a.last_seen_at,
        )
        for a in agents
    ]
    agent_rows.sort(key=lambda r: r.call_volume_24h, reverse=True)

    # Reuse one expression object across select/group_by/order_by — three
    # separately-constructed func.date_trunc(...) calls compile to distinct
    # bound parameters and Postgres won't recognize them as the same
    # grouping expression.
    hour_bucket = func.date_trunc("hour", AgentCallEvent.occurred_at)
    bucket_rows = db.execute(
        select(hour_bucket, func.sum(AgentCallEvent.count))
        .where(AgentCallEvent.organization_id == current_user.organization_id, AgentCallEvent.occurred_at >= since)
        .group_by(hour_bucket)
        .order_by(hour_bucket)
    ).all()
    hourly_buckets = [MonitoringHourlyBucket(hour_start=hour, call_count=int(total)) for hour, total in bucket_rows]

    return MonitoringOverviewOut(
        total_calls_24h=sum(volume_by_agent.values()),
        active_agents_24h=len(volume_by_agent),
        idle_agents=len(agents) - len(volume_by_agent),
        hourly_buckets=hourly_buckets,
        agents=agent_rows,
    )
