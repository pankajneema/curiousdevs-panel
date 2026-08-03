"""Seed data created once, when a new organization registers -- mirrors the
three demo agents the old frontend mock shipped with, so a fresh org isn't
completely empty on first login."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import Agent, BillingAccount, NotificationPrefs
from app.models.notification import DEFAULT_NOTIFICATION_PREFS


def seed_organization(db: Session, organization_id: str) -> None:
    db.add(BillingAccount(organization_id=organization_id, plan="trial"))

    now = datetime.now(UTC)
    db.add_all(
        [
            Agent(
                organization_id=organization_id,
                name="support-agent",
                purpose="Tier-1 customer support: order status, refunds under policy limit",
                environment="PROD",
                connection_method="mcp",
                status="active",
                risk_band="medium",
                has_lethal_trifecta=True,
                agent_version="sha256:8f2a...c910",
                expires_at=now + timedelta(days=180),
                last_seen_at=now,
                call_volume_24h=4812,
            ),
            Agent(
                organization_id=organization_id,
                name="billing-agent",
                purpose="Refund execution and invoice adjustment for the billing team",
                environment="PROD",
                connection_method="mcp",
                status="active",
                risk_band="high",
                has_lethal_trifecta=False,
                agent_version="sha256:1c77...4ae2",
                expires_at=now + timedelta(days=150),
                last_seen_at=now,
                call_volume_24h=913,
            ),
            Agent(
                organization_id=organization_id,
                name="release-notes-bot",
                purpose="Drafts release notes from merged PRs, posts to the docs repo",
                environment="STAGING",
                connection_method="python_sdk",
                status="watch_only",
                risk_band="low",
                has_lethal_trifecta=False,
                agent_version="sha256:0d1e...77bb",
                expires_at=now + timedelta(days=60),
                last_seen_at=now,
                call_volume_24h=26,
            ),
        ]
    )


def seed_user_defaults(db: Session, user_id: str) -> None:
    db.add(NotificationPrefs(user_id=user_id, prefs=dict(DEFAULT_NOTIFICATION_PREFS)))
