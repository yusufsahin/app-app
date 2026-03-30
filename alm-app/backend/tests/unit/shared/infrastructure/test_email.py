from __future__ import annotations

from unittest.mock import AsyncMock, Mock

import pytest

from alm.shared.infrastructure import email as email_mod


class _FakeSMTP:
    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = port
        self.started_tls = False
        self.login_args: tuple[str, str] | None = None
        self.sendmail_args: tuple[str, list[str], str] | None = None

    def __enter__(self) -> _FakeSMTP:
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
        return None

    def starttls(self) -> None:
        self.started_tls = True

    def login(self, username: str, password: str) -> None:
        self.login_args = (username, password)

    def sendmail(self, from_addr: str, to_addrs: list[str], msg: str) -> None:
        self.sendmail_args = (from_addr, to_addrs, msg)


@pytest.mark.asyncio
async def test_send_email_uses_to_thread() -> None:
    to_thread_mock = AsyncMock(return_value=None)
    email_send_mock = AsyncMock(return_value=None)

    original = email_mod._send_sync
    try:
        email_mod._send_sync = email_send_mock  # type: ignore[assignment]
        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(email_mod.asyncio, "to_thread", to_thread_mock)
            await email_mod.send_email("user@example.com", "Sub", "<b>x</b>")
    finally:
        email_mod._send_sync = original  # type: ignore[assignment]

    to_thread_mock.assert_awaited_once_with(
        email_send_mock,
        "user@example.com",
        "Sub",
        "<b>x</b>",
    )


@pytest.mark.asyncio
async def test_smtp_email_sender_delegates_to_send_email() -> None:
    send_email_mock = AsyncMock(return_value=None)
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(email_mod, "send_email", send_email_mock)
        sender = email_mod.SmtpEmailSender()
        await sender.send("u@example.com", "Welcome", "<p>Hello</p>")

    send_email_mock.assert_awaited_once_with("u@example.com", "Welcome", "<p>Hello</p>")


def test_send_sync_tls_with_login_and_sendmail() -> None:
    created: list[_FakeSMTP] = []

    def _smtp_factory(host: str, port: int) -> _FakeSMTP:
        inst = _FakeSMTP(host, port)
        created.append(inst)
        return inst

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(email_mod.smtplib, "SMTP", _smtp_factory)
        mp.setattr(email_mod.settings, "smtp_from", "noreply@example.com")
        mp.setattr(email_mod.settings, "smtp_host", "smtp.example.com")
        mp.setattr(email_mod.settings, "smtp_port", 587)
        mp.setattr(email_mod.settings, "smtp_tls", True)
        mp.setattr(email_mod.settings, "smtp_username", "user")
        mp.setattr(email_mod.settings, "smtp_password", "pass")
        info_mock = Mock()
        mp.setattr(email_mod.logger, "info", info_mock)

        email_mod._send_sync("to@example.com", "Subject", "<p>Body</p>")

    assert len(created) == 1
    smtp = created[0]
    assert smtp.host == "smtp.example.com"
    assert smtp.port == 587
    assert smtp.started_tls is True
    assert smtp.login_args == ("user", "pass")
    assert smtp.sendmail_args is not None
    assert smtp.sendmail_args[0] == "noreply@example.com"
    assert smtp.sendmail_args[1] == ["to@example.com"]
    assert "Subject" in smtp.sendmail_args[2]
    info_mock.assert_called_once()


def test_send_sync_without_tls_and_without_login() -> None:
    created: list[_FakeSMTP] = []

    def _smtp_factory(host: str, port: int) -> _FakeSMTP:
        inst = _FakeSMTP(host, port)
        created.append(inst)
        return inst

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(email_mod.smtplib, "SMTP", _smtp_factory)
        mp.setattr(email_mod.settings, "smtp_from", "noreply@example.com")
        mp.setattr(email_mod.settings, "smtp_host", "smtp.example.com")
        mp.setattr(email_mod.settings, "smtp_port", 25)
        mp.setattr(email_mod.settings, "smtp_tls", False)
        mp.setattr(email_mod.settings, "smtp_username", "")
        mp.setattr(email_mod.settings, "smtp_password", "")

        email_mod._send_sync("to@example.com", "Subject", "<p>Body</p>")

    smtp = created[0]
    assert smtp.started_tls is False
    assert smtp.login_args is None
    assert smtp.sendmail_args is not None


def test_send_sync_logs_error_on_failure() -> None:
    class _BoomSMTP(_FakeSMTP):
        def sendmail(self, from_addr: str, to_addrs: list[str], msg: str) -> None:
            raise RuntimeError("boom")

    error_mock = Mock()

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(email_mod.smtplib, "SMTP", lambda host, port: _BoomSMTP(host, port))
        mp.setattr(email_mod.settings, "smtp_from", "noreply@example.com")
        mp.setattr(email_mod.settings, "smtp_host", "smtp.example.com")
        mp.setattr(email_mod.settings, "smtp_port", 25)
        mp.setattr(email_mod.settings, "smtp_tls", False)
        mp.setattr(email_mod.settings, "smtp_username", "")
        mp.setattr(email_mod.settings, "smtp_password", "")
        mp.setattr(email_mod.logger, "error", error_mock)

        email_mod._send_sync("to@example.com", "Subject", "<p>Body</p>")

    error_mock.assert_called_once()
