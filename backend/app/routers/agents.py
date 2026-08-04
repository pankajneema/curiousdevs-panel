import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import func, select

from app.audit import record, record_system
from app.deps import CurrentApiKey, CurrentUser, DbSession, require_agent_scope
from app.errors import api_error
from app.ids import new_id
from app.models import Agent, AgentCallEvent, ApiKey, McpServer, Policy, User
from app.routers.mcp_servers import _verify_mcp_server, find_or_create_mcp_server, mcp_server_to_out
from app.routers.policies import policy_to_out
from app.schemas.agent import (
    AgentActivityIn,
    AgentOut,
    AgentReportIn,
    CreateAgentIn,
    UpdateAgentIn,
    UpdateAgentPoliciesIn,
    UpdateAgentStatusIn,
)
from app.schemas.api_key import ApiKeyOut, CreateApiKeyIn, CreatedApiKeyOut
from app.schemas.mcp_server import McpServerOut
from app.schemas.policy import PolicyOut
from app.security import generate_api_secret

router = APIRouter(prefix="/agents", tags=["agents"])

ENVIRONMENTS = {"DEV", "STAGING", "PROD"}
CONNECTION_METHODS = {"mcp", "python_sdk", "typescript_sdk", "proxy"}
RISK_BANDS = {"low", "medium", "high", "critical"}
STATUSES = {"active", "watch_only", "quarantined", "decommissioned"}


def _validate_agent_fields(
    db: DbSession, organization_id: str, environment: str, connection_methods: list[str], risk_band: str, owner_user_id: str | None
) -> None:
    if environment not in ENVIRONMENTS:
        raise api_error("Choose a valid environment.", "environment")
    if len(connection_methods) == 0:
        raise api_error("Choose at least one connection method.", "connectionMethods")
    if not set(connection_methods).issubset(CONNECTION_METHODS):
        raise api_error("Choose a valid connection method.", "connectionMethods")
    if risk_band not in RISK_BANDS:
        raise api_error("Choose a valid risk band.", "riskBand")
    if owner_user_id is not None:
        owner = db.get(User, owner_user_id)
        if not owner or owner.organization_id != organization_id:
            raise api_error("Choose a valid owner.", "ownerUserId")


def call_volume_24h(db: DbSession, agent_id: str) -> int:
    since = datetime.now(UTC) - timedelta(hours=24)
    return (
        db.scalar(
            select(func.coalesce(func.sum(AgentCallEvent.count), 0)).where(
                AgentCallEvent.agent_id == agent_id, AgentCallEvent.occurred_at >= since
            )
        )
        or 0
    )


def agent_to_out(db: DbSession, agent: Agent) -> AgentOut:
    return AgentOut(
        id=agent.id,
        name=agent.name,
        purpose=agent.purpose,
        owner_user_id=agent.owner_user_id,
        environment=agent.environment,
        connection_methods=agent.connection_methods,
        status=agent.status,
        risk_band=agent.risk_band,
        has_lethal_trifecta=agent.has_lethal_trifecta,
        agent_version=agent.agent_version,
        expires_at=agent.expires_at,
        created_at=agent.created_at,
        last_seen_at=agent.last_seen_at,
        call_volume_24h=call_volume_24h(db, agent.id),
    )


@router.get("", response_model=list[AgentOut])
def list_agents(current_user: CurrentUser, db: DbSession) -> list[AgentOut]:
    agents = db.scalars(select(Agent).where(Agent.organization_id == current_user.organization_id)).all()
    return [agent_to_out(db, a) for a in agents]


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: str, current_user: CurrentUser, db: DbSession) -> AgentOut:
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != current_user.organization_id:
        raise api_error("Agent not found.", status_code=404)
    return agent_to_out(db, agent)


@router.post("", response_model=AgentOut)
def create_agent(payload: CreateAgentIn, current_user: CurrentUser, db: DbSession) -> AgentOut:
    name = payload.name.strip()
    if len(name) < 1:
        raise api_error("Name this agent.", "name")
    purpose = payload.purpose.strip()
    if len(purpose) < 1:
        raise api_error("Describe what this agent does.", "purpose")
    _validate_agent_fields(
        db, current_user.organization_id, payload.environment, payload.connection_methods, payload.risk_band, payload.owner_user_id
    )

    agent = Agent(
        id=new_id("agt"),
        organization_id=current_user.organization_id,
        name=name,
        purpose=purpose,
        owner_user_id=payload.owner_user_id or current_user.id,
        environment=payload.environment,
        connection_methods=payload.connection_methods,
        status="active",
        risk_band=payload.risk_band,
        has_lethal_trifecta=payload.has_lethal_trifecta,
        # No real SDK handshake exists yet to report a build hash — honest
        # placeholder until the agent's first real connection reports one.
        agent_version="pending-first-connection",
        expires_at=payload.expires_at,
    )
    db.add(agent)
    record(db, current_user, "agent.created", "agent", agent.id, name, f"Registered agent “{name}”")
    db.commit()
    db.refresh(agent)
    return agent_to_out(db, agent)


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: str, payload: UpdateAgentIn, current_user: CurrentUser, db: DbSession) -> AgentOut:
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != current_user.organization_id:
        raise api_error("Agent not found.")

    name = payload.name.strip()
    if len(name) < 1:
        raise api_error("Name this agent.", "name")
    purpose = payload.purpose.strip()
    if len(purpose) < 1:
        raise api_error("Describe what this agent does.", "purpose")
    _validate_agent_fields(
        db, current_user.organization_id, payload.environment, payload.connection_methods, payload.risk_band, payload.owner_user_id
    )

    agent.name = name
    agent.purpose = purpose
    agent.environment = payload.environment
    agent.connection_methods = payload.connection_methods
    agent.risk_band = payload.risk_band
    agent.has_lethal_trifecta = payload.has_lethal_trifecta
    agent.owner_user_id = payload.owner_user_id
    agent.expires_at = payload.expires_at
    record(db, current_user, "agent.updated", "agent", agent.id, agent.name, f"Updated agent “{agent.name}”")
    db.commit()
    db.refresh(agent)
    return agent_to_out(db, agent)


@router.patch("/{agent_id}/status", response_model=AgentOut)
def update_agent_status(agent_id: str, payload: UpdateAgentStatusIn, current_user: CurrentUser, db: DbSession) -> AgentOut:
    if payload.status not in STATUSES:
        raise api_error("Choose a valid status.", "status")
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != current_user.organization_id:
        raise api_error("Agent not found.")
    old_status = agent.status
    agent.status = payload.status
    record(
        db,
        current_user,
        "agent.status_changed",
        "agent",
        agent.id,
        agent.name,
        f"Changed “{agent.name}” status from {old_status} to {payload.status}",
    )
    db.commit()
    db.refresh(agent)
    return agent_to_out(db, agent)


@router.get("/{agent_id}/policies", response_model=list[PolicyOut])
def list_agent_policies(agent_id: str, current_user: CurrentUser, db: DbSession) -> list[PolicyOut]:
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != current_user.organization_id:
        raise api_error("Agent not found.", status_code=404)
    return [policy_to_out(db, p) for p in agent.policies]


@router.put("/{agent_id}/policies", response_model=list[PolicyOut])
def set_agent_policies(
    agent_id: str, payload: UpdateAgentPoliciesIn, current_user: CurrentUser, db: DbSession
) -> list[PolicyOut]:
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != current_user.organization_id:
        raise api_error("Agent not found.", status_code=404)

    policies = db.scalars(
        select(Policy).where(Policy.id.in_(payload.policy_ids), Policy.organization_id == current_user.organization_id)
    ).all()
    agent.policies = list(policies)
    names = ", ".join(p.name for p in policies) if policies else "none"
    record(
        db, current_user, "agent.policies_changed", "agent", agent.id, agent.name, f"Set policies on “{agent.name}” to: {names}"
    )
    db.commit()
    db.refresh(agent)
    return [policy_to_out(db, p) for p in agent.policies]


@router.get("/{agent_id}/mcp-servers", response_model=list[McpServerOut])
def list_agent_mcp_servers(agent_id: str, current_user: CurrentUser, db: DbSession) -> list[McpServerOut]:
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != current_user.organization_id:
        raise api_error("Agent not found.", status_code=404)
    return [mcp_server_to_out(db, s) for s in agent.mcp_servers]


@router.post("/{agent_id}/report", response_model=AgentOut)
def report_agent(
    agent_id: str, payload: AgentReportIn, api_key: CurrentApiKey, db: DbSession, background_tasks: BackgroundTasks
) -> AgentOut:
    """What an agent's own SDK calls on init/heartbeat, authenticated with a
    real API key instead of a signed-in user's session — this is how
    connection status and the MCP registry become true without an admin
    manually clicking anything."""
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != api_key.organization_id:
        raise api_error("Agent not found.", status_code=404)
    require_agent_scope(api_key, agent_id)

    is_first_connection = agent.last_seen_at is None
    agent.last_seen_at = datetime.now(UTC)
    if payload.agent_version:
        agent.agent_version = payload.agent_version

    reported_servers: list[McpServer] = []
    if payload.mcp_servers_config:
        try:
            parsed = json.loads(payload.mcp_servers_config)
        except json.JSONDecodeError:
            raise api_error("mcpServersConfig isn't valid JSON.", "mcpServersConfig")
        entries = parsed.get("mcpServers") if isinstance(parsed, dict) else None
        if isinstance(entries, dict):
            newly_created: list[McpServer] = []
            for name, entry in entries.items():
                if not isinstance(entry, dict):
                    continue
                found = find_or_create_mcp_server(db, agent.organization_id, str(name).strip(), entry)
                if found is None:
                    continue
                server, was_created = found
                reported_servers.append(server)
                if was_created:
                    newly_created.append(server)
            # This report describes the agent's current config, not an
            # addition to history — replace the set rather than appending.
            agent.mcp_servers = reported_servers
            for server in newly_created:
                if server.transport == "http":
                    background_tasks.add_task(_verify_mcp_server, server.id, agent.organization_id)

    if is_first_connection:
        summary = f"“{agent.name}” connected for the first time"
    elif reported_servers:
        summary = f"“{agent.name}” checked in, reporting {len(reported_servers)} MCP server(s)"
    else:
        summary = f"“{agent.name}” checked in"
    record_system(db, agent.organization_id, agent.name, "agent.reported", "agent", agent.id, agent.name, summary)

    db.commit()
    db.refresh(agent)
    return agent_to_out(db, agent)


@router.post("/{agent_id}/activity", status_code=204)
def report_agent_activity(agent_id: str, payload: AgentActivityIn, api_key: CurrentApiKey, db: DbSession) -> None:
    """A real call-volume report — the only thing an agent's 24h call count
    is ever computed from. There's no stored counter to drift out of sync;
    an agent that never calls this simply shows 0."""
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != api_key.organization_id:
        raise api_error("Agent not found.", status_code=404)
    require_agent_scope(api_key, agent_id)
    if payload.count < 1:
        raise api_error("count must be at least 1.", "count")

    db.add(
        AgentCallEvent(
            organization_id=agent.organization_id,
            agent_id=agent.id,
            count=payload.count,
            occurred_at=payload.occurred_at or datetime.now(UTC),
        )
    )
    agent.last_seen_at = datetime.now(UTC)
    db.commit()


@router.get("/{agent_id}/api-keys", response_model=list[ApiKeyOut])
def list_agent_api_keys(agent_id: str, current_user: CurrentUser, db: DbSession) -> list[ApiKeyOut]:
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != current_user.organization_id:
        raise api_error("Agent not found.", status_code=404)
    return list(db.scalars(select(ApiKey).where(ApiKey.agent_id == agent_id)).all())


@router.post("/{agent_id}/api-keys", response_model=CreatedApiKeyOut)
def create_agent_api_key(
    agent_id: str, payload: CreateApiKeyIn, current_user: CurrentUser, db: DbSession
) -> CreatedApiKeyOut:
    """A credential scoped to exactly this agent — unlike an org-wide
    Developer key, this one is rejected by require_agent_scope for every
    other agent, so a leaked key only ever compromises the one agent."""
    agent = db.get(Agent, agent_id)
    if not agent or agent.organization_id != current_user.organization_id:
        raise api_error("Agent not found.", status_code=404)
    name = payload.name.strip()
    if len(name) < 1:
        raise api_error("Name this key so you can find it later.", "name")

    secret, prefix, secret_hash = generate_api_secret()
    key = ApiKey(
        organization_id=current_user.organization_id,
        created_by_user_id=current_user.id,
        agent_id=agent.id,
        name=name,
        prefix=prefix,
        secret_hash=secret_hash,
        expires_at=payload.expires_at,
    )
    db.add(key)
    record(db, current_user, "agent.api_key_created", "agent", agent.id, agent.name, f"Created API key “{name}” for “{agent.name}”")
    db.commit()
    db.refresh(key)
    return CreatedApiKeyOut(key=ApiKeyOut.model_validate(key), secret=secret)


@router.delete("/{agent_id}/api-keys/{key_id}", status_code=204)
def revoke_agent_api_key(agent_id: str, key_id: str, current_user: CurrentUser, db: DbSession) -> None:
    key = db.get(ApiKey, key_id)
    if key and key.agent_id == agent_id and key.organization_id == current_user.organization_id:
        record(db, current_user, "agent.api_key_revoked", "agent", agent_id, key.name, f"Revoked API key “{key.name}”")
        db.delete(key)
        db.commit()
