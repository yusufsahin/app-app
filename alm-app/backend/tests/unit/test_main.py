from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI

from alm.main import create_app, lifespan


class TestCreateApp:
    def test_create_app_configures_debug_docs(self) -> None:
        with (
            patch("alm.main.settings.debug", True),
            patch("alm.main.settings.app_name", "ALM-Test"),
            patch("alm.main.register_exception_handlers") as register_handlers,
            patch("alm.config.handler_registry.register_all_handlers") as register_all_handlers,
            patch("alm.main.make_asgi_app", return_value=FastAPI()),
        ):
            app = create_app()

        assert app.title == "ALM-Test"
        assert app.docs_url == "/api/docs"
        assert app.redoc_url == "/api/redoc"
        register_all_handlers.assert_called_once()
        register_handlers.assert_called_once_with(app)

    def test_create_app_instruments_fastapi_in_non_debug(self) -> None:
        with (
            patch("alm.main.settings.debug", False),
            patch("alm.main.register_exception_handlers"),
            patch("alm.config.handler_registry.register_all_handlers"),
            patch("alm.main.make_asgi_app", return_value=FastAPI()),
            patch("opentelemetry.instrumentation.fastapi.FastAPIInstrumentor.instrument_app") as instrument_app,
        ):
            app = create_app()

        instrument_app.assert_called_once_with(app)


class TestLifespan:
    @pytest.mark.asyncio
    async def test_rejects_default_jwt_secret_in_non_debug(self) -> None:
        with (
            patch("alm.main.settings.debug", False),
            patch("alm.main.settings.jwt_secret_key", "CHANGE-ME-IN-PRODUCTION"),
        ):
            with pytest.raises(RuntimeError, match="jwt_secret_key must be changed in production"):
                async with lifespan(FastAPI()):
                    pass

    @pytest.mark.asyncio
    async def test_run_startup_seeds_and_cancels_subscriber(self) -> None:
        cancelled = asyncio.Event()

        async def _subscriber() -> None:
            try:
                await asyncio.Future()
            except asyncio.CancelledError:
                cancelled.set()
                raise

        async_run_startup_seeds = AsyncMock()

        with (
            patch("alm.main.settings.debug", True),
            patch("alm.main.settings.seed_demo_data", True),
            patch("alm.main.settings.environment", "development"),
            patch("alm.main.setup_tenant_rls") as setup_rls,
            patch("alm.main.run_subscriber", side_effect=_subscriber),
            patch("alm.config.seed.run_startup_seeds", async_run_startup_seeds),
        ):
            app = FastAPI()
            async with lifespan(app):
                await asyncio.sleep(0)

        setup_rls.assert_called_once()
        async_run_startup_seeds.assert_awaited_once()
        assert cancelled.is_set()

    @pytest.mark.asyncio
    async def test_run_startup_seeds_called_in_production_when_demo_disabled(self) -> None:
        async_run_startup_seeds = AsyncMock()

        async def _subscriber() -> None:
            await asyncio.Future()

        with (
            patch("alm.main.settings.debug", True),
            patch("alm.main.settings.seed_demo_data", False),
            patch("alm.main.settings.environment", "production"),
            patch("alm.main.setup_tenant_rls"),
            patch("alm.main.run_subscriber", side_effect=_subscriber),
            patch("alm.config.seed.run_startup_seeds", async_run_startup_seeds),
        ):
            async with lifespan(FastAPI()):
                pass

        async_run_startup_seeds.assert_awaited_once()
