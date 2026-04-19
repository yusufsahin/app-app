from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.exc import ProgrammingError

from alm.shared.infrastructure.health import liveness, readiness


def _mock_outbox_aggregate(total: int, exhausted: int = 0) -> MagicMock:
    m = MagicMock()
    m.mappings.return_value.one.return_value = {"total": total, "exhausted": exhausted}
    return m


class _AsyncConnCtx:
    def __init__(self, conn: object) -> None:
        self._conn = conn

    async def __aenter__(self) -> object:
        return self._conn

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


@pytest.mark.asyncio
async def test_liveness_ok() -> None:
    assert await liveness() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readiness_ok_with_metadata() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(side_effect=[MagicMock(), _mock_outbox_aggregate(2, 0)])
    fake_engine = SimpleNamespace(connect=lambda: _AsyncConnCtx(conn))

    with (
        patch("alm.shared.infrastructure.health.engine", fake_engine),
        patch("alm.shared.infrastructure.health.settings.app_version", "1.2.3"),
        patch("alm.shared.infrastructure.health.settings.environment", "staging"),
        patch("alm.shared.infrastructure.health.settings.mpc_mode", "degraded"),
        patch("alm.shared.infrastructure.health.HAS_MPC", True),
    ):
        out = await readiness()

    assert out["status"] == "ok"
    assert out["db"] == "ok"
    assert out["domain_event_outbox_pending"] == 2
    assert out["domain_event_outbox_exhausted_rows"] == 0
    assert out["app_version"] == "1.2.3"
    assert out["environment"] == "staging"
    assert out["mpc_installed"] is True
    assert out["mpc_mode"] == "degraded"


@pytest.mark.asyncio
async def test_readiness_degraded_when_db_fails() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(side_effect=RuntimeError("db down"))
    fake_engine = SimpleNamespace(connect=lambda: _AsyncConnCtx(conn))

    with (
        patch("alm.shared.infrastructure.health.engine", fake_engine),
        patch("alm.shared.infrastructure.health.settings.app_version", ""),
        patch("alm.shared.infrastructure.health.settings.environment", "development"),
        patch("alm.shared.infrastructure.health.settings.mpc_mode", "strict"),
        patch("alm.shared.infrastructure.health.HAS_MPC", True),
    ):
        out = await readiness()

    assert out["status"] == "degraded"
    assert out["db"] == "error"
    assert "app_version" not in out
    assert out["environment"] == "development"


@pytest.mark.asyncio
async def test_readiness_degraded_when_production_without_mpc() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(side_effect=[MagicMock(), _mock_outbox_aggregate(0, 0)])
    fake_engine = SimpleNamespace(connect=lambda: _AsyncConnCtx(conn))

    with (
        patch("alm.shared.infrastructure.health.engine", fake_engine),
        patch("alm.shared.infrastructure.health.settings.app_version", "1.0.0"),
        patch("alm.shared.infrastructure.health.settings.environment", "production"),
        patch("alm.shared.infrastructure.health.settings.mpc_mode", "strict"),
        patch("alm.shared.infrastructure.health.HAS_MPC", False),
    ):
        out = await readiness()

    assert out["db"] == "ok"
    assert out["domain_event_outbox_pending"] == 0
    assert out["domain_event_outbox_exhausted_rows"] == 0
    assert out["status"] == "degraded"
    assert out["mpc_installed"] is False
    assert "mpc_note" in out


@pytest.mark.asyncio
async def test_readiness_pending_outbox_when_table_missing() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(
        side_effect=[
            MagicMock(),
            ProgrammingError("statement", {}, orig=Exception("relation domain_event_outbox does not exist")),
        ]
    )
    fake_engine = SimpleNamespace(connect=lambda: _AsyncConnCtx(conn))

    with (
        patch("alm.shared.infrastructure.health.engine", fake_engine),
        patch("alm.shared.infrastructure.health.settings.app_version", ""),
        patch("alm.shared.infrastructure.health.settings.environment", "development"),
        patch("alm.shared.infrastructure.health.settings.mpc_mode", "strict"),
        patch("alm.shared.infrastructure.health.HAS_MPC", True),
    ):
        out = await readiness()

    assert out["status"] == "ok"
    assert out["db"] == "ok"
    assert out["domain_event_outbox_pending"] is None
    assert out["domain_event_outbox_note"] == "table_missing_run_migrations"


@pytest.mark.asyncio
async def test_readiness_pending_outbox_when_count_fails() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(side_effect=[MagicMock(), RuntimeError("count failed")])
    fake_engine = SimpleNamespace(connect=lambda: _AsyncConnCtx(conn))

    with (
        patch("alm.shared.infrastructure.health.engine", fake_engine),
        patch("alm.shared.infrastructure.health.settings.app_version", ""),
        patch("alm.shared.infrastructure.health.settings.environment", "development"),
        patch("alm.shared.infrastructure.health.settings.mpc_mode", "strict"),
        patch("alm.shared.infrastructure.health.HAS_MPC", True),
    ):
        out = await readiness()

    assert out["status"] == "ok"
    assert out["domain_event_outbox_pending"] is None
    assert out["domain_event_outbox_note"] == "pending_count_unavailable"


@pytest.mark.asyncio
async def test_readiness_degraded_when_outbox_backlog_above_threshold() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(side_effect=[MagicMock(), _mock_outbox_aggregate(42, 3)])
    fake_engine = SimpleNamespace(connect=lambda: _AsyncConnCtx(conn))

    with (
        patch("alm.shared.infrastructure.health.engine", fake_engine),
        patch("alm.shared.infrastructure.health.settings.app_version", ""),
        patch("alm.shared.infrastructure.health.settings.environment", "development"),
        patch("alm.shared.infrastructure.health.settings.mpc_mode", "strict"),
        patch("alm.shared.infrastructure.health.settings.domain_event_outbox_readiness_max_pending", 10),
        patch("alm.shared.infrastructure.health.HAS_MPC", True),
    ):
        out = await readiness()

    assert out["status"] == "degraded"
    assert out["db"] == "ok"
    assert out["domain_event_outbox_pending"] == 42
    assert out["domain_event_outbox_exhausted_rows"] == 3
    assert out["domain_event_outbox_readiness_max_pending"] == 10
    assert out["domain_event_outbox_backlog"] == "above_threshold"


@pytest.mark.asyncio
async def test_readiness_degraded_when_exhausted_rows_and_flag_enabled() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(side_effect=[MagicMock(), _mock_outbox_aggregate(10, 2)])
    fake_engine = SimpleNamespace(connect=lambda: _AsyncConnCtx(conn))

    with (
        patch("alm.shared.infrastructure.health.engine", fake_engine),
        patch("alm.shared.infrastructure.health.settings.app_version", ""),
        patch("alm.shared.infrastructure.health.settings.environment", "development"),
        patch("alm.shared.infrastructure.health.settings.mpc_mode", "strict"),
        patch(
            "alm.shared.infrastructure.health.settings.domain_event_outbox_readiness_degrade_on_exhausted",
            True,
        ),
        patch("alm.shared.infrastructure.health.HAS_MPC", True),
    ):
        out = await readiness()

    assert out["status"] == "degraded"
    assert out["db"] == "ok"
    assert out["domain_event_outbox_pending"] == 10
    assert out["domain_event_outbox_exhausted_rows"] == 2
    assert out["domain_event_outbox_dead_letter"] == "present"


@pytest.mark.asyncio
async def test_readiness_ok_when_exhausted_rows_but_flag_disabled() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(side_effect=[MagicMock(), _mock_outbox_aggregate(3, 1)])
    fake_engine = SimpleNamespace(connect=lambda: _AsyncConnCtx(conn))

    with (
        patch("alm.shared.infrastructure.health.engine", fake_engine),
        patch("alm.shared.infrastructure.health.settings.app_version", ""),
        patch("alm.shared.infrastructure.health.settings.environment", "development"),
        patch("alm.shared.infrastructure.health.settings.mpc_mode", "strict"),
        patch(
            "alm.shared.infrastructure.health.settings.domain_event_outbox_readiness_degrade_on_exhausted",
            False,
        ),
        patch("alm.shared.infrastructure.health.HAS_MPC", True),
    ):
        out = await readiness()

    assert out["status"] == "ok"
    assert out["domain_event_outbox_exhausted_rows"] == 1
    assert "domain_event_outbox_dead_letter" not in out
