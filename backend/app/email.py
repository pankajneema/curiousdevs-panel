import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


class EmailNotConfigured(RuntimeError):
    pass


def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    if not settings.smtp_server or not settings.smtp_email or not settings.smtp_password:
        raise EmailNotConfigured("SMTP is not configured.")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.smtp_email
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_server, settings.smtp_port, timeout=15) as server:
        server.starttls()
        server.login(settings.smtp_email, settings.smtp_password)
        server.sendmail(settings.smtp_email, [to_email], message.as_string())


# Gmail (and most webmail) strips data:/inline image sources from received
# mail as a security measure — that's what produced the earlier blank box.
# The logo has to be a real hosted file at a public URL email clients can
# fetch server-side; www.curiousdevs.com/apple-touch-icon.png is the same
# C-Dot mark as frontend/src/components/Logo.tsx, already live.

# Brand tokens, from frontend/src/styles/tokens.css.
_INK = "#0a1424"
_SIGNAL = "#1c60fa"
_PAPER = "#faf8f5"
_RULE = "#e3ded6"
_SLATE = "#5a6572"


def build_invitation_email(inviter_name: str, org_name: str, role_label: str, accept_url: str) -> tuple[str, str, str]:
    subject = f"{inviter_name} invited you to join {org_name} on AgentGuard"

    text_body = (
        f"{inviter_name} has invited you to join {org_name} on AgentGuard as {role_label}.\n\n"
        f"Accept your invitation:\n{accept_url}\n\n"
        "This link expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.\n\n"
        "— The CuriousDevs Team"
    )

    html_body = f"""\
<div style="background:{_PAPER}; padding:40px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px; margin:0 auto; background:#ffffff; border:1px solid {_RULE};">
    <div style="border-top:3px solid {_SIGNAL};"></div>
    <div style="padding:32px 32px 28px;">
      <div style="margin-bottom:28px;">
        <img src="{settings.brand_logo_url}" width="26" height="26" alt="CuriousDevs"
             style="display:inline-block; vertical-align:middle; margin-right:9px; border:0;" />
        <span style="font-size:18px; font-weight:700; letter-spacing:-0.01em; color:{_INK}; vertical-align:middle;">
          Curious<span style="color:{_SIGNAL};">Devs</span>
        </span>
      </div>

      <p style="font-size:15px; color:{_INK}; line-height:1.6; margin:0 0 20px;">
        <strong>{inviter_name}</strong> has invited you to join <strong>{org_name}</strong> on AgentGuard
        as <strong>{role_label}</strong>.
      </p>

      <a href="{accept_url}"
         style="display:inline-block; background:{_SIGNAL}; color:#ffffff; padding:12px 22px;
                text-decoration:none; font-weight:600; font-size:14px; border-radius:0;">
        Accept invitation
      </a>

      <p style="font-size:12.5px; color:{_SLATE}; line-height:1.6; margin:22px 0 0;">
        This link expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.
      </p>

      <p style="font-size:11.5px; color:{_SLATE}; word-break:break-all; margin:10px 0 0;">
        {accept_url}
      </p>
    </div>

    <div style="border-top:1px solid {_RULE}; padding:18px 32px; background:{_PAPER};">
      <p style="font-size:12px; color:{_SLATE}; margin:0;">
        Sent by <strong style="color:{_INK};">CuriousDevs</strong> — agent identity, policy enforcement
        and audit for the systems you run.
      </p>
    </div>
  </div>
</div>
"""
    return subject, html_body, text_body
