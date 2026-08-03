from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class NotificationPrefs(Base):
    """One row per user. `prefs` is keyed exactly like the frontend's
    NotificationPrefs type: "<event>:<channel>" -> bool."""

    __tablename__ = "notification_prefs"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    prefs: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


DEFAULT_NOTIFICATION_PREFS: dict[str, bool] = {
    "agent_failure:email": True,
    "agent_failure:browser": True,
    "agent_failure:slack": False,
    "agent_failure:teams": False,
    "agent_failure:sms": False,
    "escalation_pending:email": True,
    "escalation_pending:browser": True,
    "escalation_pending:slack": False,
    "escalation_pending:teams": False,
    "escalation_pending:sms": False,
    "weekly_report:email": True,
    "weekly_report:browser": False,
    "weekly_report:slack": False,
    "weekly_report:teams": False,
    "weekly_report:sms": False,
    "critical_alert:email": True,
    "critical_alert:browser": True,
    "critical_alert:slack": False,
    "critical_alert:teams": False,
    "critical_alert:sms": False,
}
