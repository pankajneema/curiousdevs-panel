"""Seed data created once, when a new organization registers -- mirrors the
three demo agents the old frontend mock shipped with, so a fresh org isn't
completely empty on first login."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.ids import new_id
from app.models import Agent, AgentCallEvent, BillingAccount, NotificationPrefs
from app.models.notification import DEFAULT_NOTIFICATION_PREFS


def _seed_call_events(organization_id: str, agent_id: str, total: int, now: datetime) -> list[AgentCallEvent]:
    """Spreads a realistic-looking total across the last 24h as real,
    timestamped rows — call volume is always computed from these, so the
    demo number has to actually be backed by them, not a separate field."""
    if total <= 0:
        return []
    hours_ago = [22, 16, 9, 3, 1]
    shares = [0.35, 0.25, 0.2, 0.15, 0.05]
    events: list[AgentCallEvent] = []
    remaining = total
    for i, (hours, share) in enumerate(zip(hours_ago, shares)):
        count = total if i == len(hours_ago) - 1 else round(total * share)
        count = min(count, remaining)
        if count <= 0:
            continue
        events.append(
            AgentCallEvent(
                organization_id=organization_id,
                agent_id=agent_id,
                count=count,
                occurred_at=now - timedelta(hours=hours),
            )
        )
        remaining -= count
    return events


def seed_organization(db: Session, organization_id: str) -> None:
    db.add(BillingAccount(organization_id=organization_id, plan="trial"))

    now = datetime.now(UTC)
    agents = [
        (
            Agent(
                id=new_id("agt"),
                organization_id=organization_id,
                name="support-agent",
                purpose="Tier-1 customer support: order status, refunds under policy limit",
                environment="PROD",
                connection_methods=["mcp", "typescript_sdk"],
                status="active",
                risk_band="medium",
                has_lethal_trifecta=True,
                agent_version="sha256:8f2a...c910",
                expires_at=now + timedelta(days=180),
                last_seen_at=now,
            ),
            4812,
        ),
        (
            Agent(
                id=new_id("agt"),
                organization_id=organization_id,
                name="billing-agent",
                purpose="Refund execution and invoice adjustment for the billing team",
                environment="PROD",
                connection_methods=["mcp"],
                status="active",
                risk_band="high",
                has_lethal_trifecta=False,
                agent_version="sha256:1c77...4ae2",
                expires_at=now + timedelta(days=150),
                last_seen_at=now,
            ),
            913,
        ),
        (
            Agent(
                id=new_id("agt"),
                organization_id=organization_id,
                name="release-notes-bot",
                purpose="Drafts release notes from merged PRs, posts to the docs repo",
                environment="STAGING",
                connection_methods=["python_sdk"],
                status="watch_only",
                risk_band="low",
                has_lethal_trifecta=False,
                agent_version="sha256:0d1e...77bb",
                expires_at=now + timedelta(days=60),
                last_seen_at=now,
            ),
            26,
        ),
    ]

    for agent, call_total in agents:
        db.add(agent)
        db.add_all(_seed_call_events(organization_id, agent.id, call_total, now))


def seed_user_defaults(db: Session, user_id: str) -> None:
    db.add(NotificationPrefs(user_id=user_id, prefs=dict(DEFAULT_NOTIFICATION_PREFS)))
