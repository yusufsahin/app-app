from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from alm.shared.infrastructure.health import liveness, readiness


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
    conn.execute = AsyncMock(return_value=None)
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
    conn.execute = AsyncMock(return_value=None)
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
    assert out["status"] == "degraded"
    assert out["mpc_installed"] is False
    assert "mpc_note" in out
