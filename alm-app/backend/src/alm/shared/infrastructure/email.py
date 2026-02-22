from __future__ import annotations

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import structlog

from alm.config.settings import settings

logger = structlog.get_logger()


async def send_email(to: str, subject: str, html_body: str) -> None:
    """Send an email via SMTP. Runs the blocking smtplib call in a thread executor."""
    await asyncio.to_thread(_send_sync, to, subject, html_body)


def _send_sync(to: str, subject: str, html_body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.smtp_tls:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.sendmail(settings.smtp_from, [to], msg.as_string())
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.sendmail(settings.smtp_from, [to], msg.as_string())
        logger.info("email_sent", to=to, subject=subject)
    except Exception:
        logger.error("email_send_failed", to=to, subject=subject, exc_info=True)
