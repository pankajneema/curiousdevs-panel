import secrets
from datetime import UTC, datetime
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.db import SessionLocal
from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.events import publish
from app.integration_checks import check_generic_webhook
from app.models import Webhook
from app.schemas.webhook import CreateWebhookIn, WebhookOut

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_webhook_blocking(webhook_id: str, organization_id: str) -> tuple[str, str] | None:
    """Sends a real HMAC-signed test delivery in a worker thread, never on
    the event loop, since it's a live network call to the customer's endpoint."""
    db = SessionLocal()
    try:
        webhook = db.get(Webhook, webhook_id)
        if webhook is None:
            return None
        ok, detail = check_generic_webhook(webhook.url, webhook.signing_secret)
        webhook.status = "verified" if ok else "failed"
        webhook.status_detail = detail
        webhook.checked_at = datetime.now(UTC)
        db.commit()
        return webhook.id, webhook.status
    finally:
        db.close()


async def _verify_webhook(webhook_id: str, organization_id: str) -> None:
    result = await run_in_threadpool(_verify_webhook_blocking, webhook_id, organization_id)
    if result is None:
        return
    verified_id, status = result
    publish(organization_id, {"type": "webhook.status", "webhookId": verified_id, "status": status})


@router.get("", response_model=list[WebhookOut])
def list_webhooks(current_user: CurrentUser, db: DbSession) -> list[WebhookOut]:
    return list(db.scalars(select(Webhook).where(Webhook.organization_id == current_user.organization_id)).all())


@router.post("", response_model=WebhookOut)
def create_webhook(
    payload: CreateWebhookIn, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks
) -> WebhookOut:
    parsed = urlparse(payload.url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise api_error("Enter a valid URL.", "url")
    if len(payload.events) == 0:
        raise api_error("Choose at least one event.", "events")

    webhook = Webhook(
        organization_id=current_user.organization_id,
        url=payload.url,
        events=payload.events,
        signing_secret=f"whsec_{secrets.token_hex(16)}",
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)

    # Queued for after this response is sent — creating a webhook returns
    # immediately instead of waiting on the customer endpoint to respond.
    background_tasks.add_task(_verify_webhook, webhook.id, current_user.organization_id)

    return webhook


@router.delete("/{webhook_id}", status_code=204)
def delete_webhook(webhook_id: str, current_user: CurrentUser, db: DbSession) -> None:
    webhook = db.get(Webhook, webhook_id)
    if webhook and webhook.organization_id == current_user.organization_id:
        db.delete(webhook)
        db.commit()
