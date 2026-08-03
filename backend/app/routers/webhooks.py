import secrets
from urllib.parse import urlparse

from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import Webhook
from app.schemas.webhook import CreateWebhookIn, WebhookOut

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("", response_model=list[WebhookOut])
def list_webhooks(current_user: CurrentUser, db: DbSession) -> list[WebhookOut]:
    return list(db.scalars(select(Webhook).where(Webhook.organization_id == current_user.organization_id)).all())


@router.post("", response_model=WebhookOut)
def create_webhook(payload: CreateWebhookIn, current_user: CurrentUser, db: DbSession) -> WebhookOut:
    parsed = urlparse(payload.url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise api_error("Enter a valid URL.", "url")
    if len(payload.events) == 0:
        raise api_error("Choose at least one event.", "events")

    webhook = Webhook(
        organization_id=current_user.organization_id,
        url=payload.url,
        events=payload.events,
        signing_secret=secrets.token_hex(16),
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return webhook


@router.delete("/{webhook_id}", status_code=204)
def delete_webhook(webhook_id: str, current_user: CurrentUser, db: DbSession) -> None:
    webhook = db.get(Webhook, webhook_id)
    if webhook and webhook.organization_id == current_user.organization_id:
        db.delete(webhook)
        db.commit()
