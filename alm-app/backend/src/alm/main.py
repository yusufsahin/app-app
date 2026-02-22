from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alm.auth.api.router import router as auth_router
from alm.config.settings import settings
from alm.shared.audit.api.router import router as audit_router
from alm.shared.infrastructure.correlation import CorrelationIdMiddleware
from alm.shared.infrastructure.db.session import async_session_factory
from alm.shared.infrastructure.db.tenant_context import setup_tenant_rls
from alm.shared.infrastructure.error_handler import register_exception_handlers
from alm.shared.infrastructure.health import health_router
from alm.tenant.api.router import router as tenant_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("application_starting", version="0.1.0")
    setup_tenant_rls(async_session_factory)

    from alm.config.handler_registry import register_all_handlers
    register_all_handlers()
    logger.info("handler_registry_initialized")

    yield
    logger.info("application_shutting_down")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs" if settings.debug else None,
        redoc_url="/api/redoc" if settings.debug else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(CorrelationIdMiddleware)

    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(tenant_router)
    app.include_router(audit_router, prefix="/api/v1")

    return app
