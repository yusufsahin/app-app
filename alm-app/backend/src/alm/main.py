from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import asyncio

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alm.admin.api.router import router as admin_router
from alm.auth.api.router import router as auth_router
from alm.config.settings import settings
from alm.shared.audit.api.router import router as audit_router
from alm.shared.infrastructure.correlation import CorrelationIdMiddleware
from alm.shared.infrastructure.tenant_middleware import TenantContextMiddleware
from alm.shared.infrastructure.rate_limit_middleware import RateLimitMiddleware
from alm.shared.infrastructure.db.session import async_session_factory
from alm.shared.infrastructure.db.tenant_context import setup_tenant_rls
from alm.shared.infrastructure.error_handler import register_exception_handlers
from alm.shared.infrastructure.health import health_router
from prometheus_client import make_asgi_app

# Import so artifact transition metrics are registered and appear in /metrics from first scrape
import alm.artifact.infrastructure.metrics  # noqa: F401
from alm.tenant.api.router import router as tenant_router
from alm.project.api.router import router as project_router
from alm.dashboard.api.router import router as dashboard_router
from alm.process_template.api.router import router as process_template_router
from alm.orgs.api.router import router as orgs_router
from alm.realtime.api.router import router as realtime_router
from alm.realtime.pubsub import run_subscriber

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("application_starting", version="0.1.0")
    if not settings.debug and settings.jwt_secret_key == "CHANGE-ME-IN-PRODUCTION":
        raise RuntimeError("jwt_secret_key must be changed in production")
    setup_tenant_rls(async_session_factory)

    from alm.config.seed import seed_privileges, seed_process_templates, seed_demo_data
    await seed_privileges(async_session_factory)
    await seed_process_templates(async_session_factory)
    await seed_demo_data(async_session_factory)

    subscriber_task = asyncio.create_task(run_subscriber())

    yield

    subscriber_task.cancel()
    try:
        await subscriber_task
    except asyncio.CancelledError:
        pass
    logger.info("application_shutting_down")


def create_app() -> FastAPI:
    from alm.config.handler_registry import register_all_handlers
    register_all_handlers()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs" if settings.debug else None,
        redoc_url="/api/redoc" if settings.debug else None,
    )

    app.add_middleware(TenantContextMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(CorrelationIdMiddleware)

    register_exception_handlers(app)

    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(tenant_router)
    app.include_router(orgs_router, prefix="/api/v1")
    app.include_router(realtime_router, prefix="/api/v1")
    app.include_router(project_router, prefix="/api/v1/tenants")
    app.include_router(dashboard_router, prefix="/api/v1/tenants")
    app.include_router(process_template_router, prefix="/api/v1")
    app.include_router(audit_router, prefix="/api/v1")

    return app
