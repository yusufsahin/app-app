from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from alm.admin.infrastructure.access_audit_store import AccessAuditStore


@pytest.mark.asyncio
async def test_record_login_success_persists_expected_fields() -> None:
    store = AccessAuditStore()
    with patch("alm.admin.infrastructure.access_audit_store.async_session_factory") as mock_factory:
        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        mock_factory.return_value.__aenter__.return_value = mock_session

        await store.record_login_success("test@example.com", "127.0.0.1", "curl/7.68.0")

        added_model = mock_session.add.call_args.args[0]
        assert added_model.type == "LOGIN_SUCCESS"
        assert added_model.email == "test@example.com"
        assert added_model.ip == "127.0.0.1"
        assert added_model.user_agent == "curl/7.68.0"
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_record_login_failure_uses_unknown_email_when_blank() -> None:
    store = AccessAuditStore()
    with patch("alm.admin.infrastructure.access_audit_store.async_session_factory") as mock_factory:
        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        mock_factory.return_value.__aenter__.return_value = mock_session

        await store.record_login_failure("", "127.0.0.1", "ua")

        added_model = mock_session.add.call_args.args[0]
        assert added_model.type == "LOGIN_FAILURE"
        assert added_model.email == "unknown"


@pytest.mark.asyncio
async def test_insert_truncates_ip_and_user_agent() -> None:
    store = AccessAuditStore()
    long_ip = "1" * 200
    long_ua = "u" * 800
    with patch("alm.admin.infrastructure.access_audit_store.async_session_factory") as mock_factory:
        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        mock_factory.return_value.__aenter__.return_value = mock_session

        await store.record_login_success("a@example.com", long_ip, long_ua)

        added_model = mock_session.add.call_args.args[0]
        assert len(added_model.ip) == 64
        assert len(added_model.user_agent) == 512


@pytest.mark.asyncio
async def test_list_entries_maps_rows_and_caps_limit() -> None:
    store = AccessAuditStore()
    ts = datetime(2026, 3, 1, 13, 0, tzinfo=UTC)
    row = SimpleNamespace(
        id=uuid.uuid4(),
        timestamp=ts,
        type="LOGIN_SUCCESS",
        email="test@example.com",
        ip="127.0.0.1",
        user_agent="curl/7.68.0",
    )

    with patch("alm.admin.infrastructure.access_audit_store.async_session_factory") as mock_factory:
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [row]
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_factory.return_value.__aenter__.return_value = mock_session

        entries = await store.list_entries(limit=900)

        assert entries == [
            {
                "id": str(row.id),
                "timestamp": ts.isoformat(),
                "type": "LOGIN_SUCCESS",
                "email": "test@example.com",
                "ip": "127.0.0.1",
                "user_agent": "curl/7.68.0",
            }
        ]

        statement = mock_session.execute.await_args.args[0]
        assert statement._limit_clause is not None
        compiled = statement.compile()
        assert 500 in compiled.params.values()


@pytest.mark.asyncio
async def test_list_entries_accepts_filters() -> None:
    store = AccessAuditStore()
    from_ts = datetime(2026, 1, 1, tzinfo=UTC)
    to_ts = datetime(2026, 2, 1, tzinfo=UTC)

    with patch("alm.admin.infrastructure.access_audit_store.async_session_factory") as mock_factory:
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_factory.return_value.__aenter__.return_value = mock_session

        await store.list_entries(from_ts=from_ts, to_ts=to_ts, type_filter="LOGIN_FAILURE", limit=10)

        statement = mock_session.execute.await_args.args[0]
        sql = str(statement)
        assert "timestamp" in sql
        assert "type" in sql
