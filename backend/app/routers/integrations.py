from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.db import SessionLocal
from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.events import publish
from app.integration_checks import CHECKS
from app.models import Integration
from app.schemas.integration import ConnectIntegrationIn, IntegrationOut

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _verify_integration_blocking(integration_id: str, organization_id: str) -> tuple[str, str] | None:
    """The real outbound check, run in a worker thread — never on the event
    loop, since it's a live network call to a third party. Returns
    (integration_id, status), or None if the row is gone by the time this runs."""
    db = SessionLocal()
    try:
        integration = db.get(Integration, integration_id)
        if integration is None:
            return None
        check = CHECKS.get(integration.kind)
        if check is None:
            ok, detail = False, f"Unknown integration kind '{integration.kind}'."
        else:
            ok, detail = check(integration.label)
        integration.status = "verified" if ok else "failed"
        integration.status_detail = detail
        integration.checked_at = datetime.now(UTC)
        db.commit()
        return integration.id, integration.status
    finally:
        db.close()


async def _verify_integration(integration_id: str, organization_id: str) -> None:
    result = await run_in_threadpool(_verify_integration_blocking, integration_id, organization_id)
    if result is None:
        return
    verified_id, status = result
    publish(organization_id, {"type": "integration.status", "integrationId": verified_id, "status": status})


@router.get("", response_model=list[IntegrationOut])
def list_integrations(current_user: CurrentUser, db: DbSession) -> list[IntegrationOut]:
    return list(
        db.scalars(select(Integration).where(Integration.organization_id == current_user.organization_id)).all()
    )


@router.post("", response_model=IntegrationOut)
def connect_integration(
    payload: ConnectIntegrationIn, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks
) -> IntegrationOut:
    label = payload.label.strip()
    if len(label) < 1:
        raise api_error("This field is required.", "label")
    if payload.kind not in CHECKS:
        raise api_error("Unknown integration kind.", "kind")

    existing = db.scalar(
        select(Integration).where(
            Integration.organization_id == current_user.organization_id, Integration.kind == payload.kind
        )
    )
    if existing:
        existing.label = label
        existing.status = "pending"
        existing.status_detail = None
        existing.checked_at = None
        integration = existing
    else:
        integration = Integration(organization_id=current_user.organization_id, kind=payload.kind, label=label)
        db.add(integration)
    db.commit()
    db.refresh(integration)

    # Queued for after this response is sent — connecting returns
    # immediately instead of waiting on a live round-trip to Slack/PagerDuty/etc.
    background_tasks.add_task(_verify_integration, integration.id, current_user.organization_id)

    return integration


@router.delete("/{integration_id}", status_code=204)
def disconnect_integration(integration_id: str, current_user: CurrentUser, db: DbSession) -> None:
    integration = db.get(Integration, integration_id)
    if integration and integration.organization_id == current_user.organization_id:
        db.delete(integration)
        db.commit()
