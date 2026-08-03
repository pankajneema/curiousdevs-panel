from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.models import NotificationPrefs
from app.models.notification import DEFAULT_NOTIFICATION_PREFS

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_or_create(db: DbSession, user_id: str) -> NotificationPrefs:
    prefs = db.get(NotificationPrefs, user_id)
    if not prefs:
        prefs = NotificationPrefs(user_id=user_id, prefs=dict(DEFAULT_NOTIFICATION_PREFS))
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


@router.get("", response_model=dict[str, bool])
def get_notification_prefs(current_user: CurrentUser, db: DbSession) -> dict[str, bool]:
    return _get_or_create(db, current_user.id).prefs


@router.patch("", response_model=dict[str, bool])
def update_notification_prefs(patch: dict[str, bool], current_user: CurrentUser, db: DbSession) -> dict[str, bool]:
    record = _get_or_create(db, current_user.id)
    record.prefs = {**record.prefs, **patch}
    db.commit()
    db.refresh(record)
    return record.prefs
