from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from alm.config.settings import settings
from alm.shared.infrastructure.db.session import engine

health_router = APIRouter(tags=["health"])


@health_router.get("/health/live")
@health_router.get("/health/liveness")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@health_router.get("/health/ready")
async def readiness() -> dict[str, str | bool | None]:
    checks: dict[str, str | bool | None] = {"status": "ok"}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception:
        checks["db"] = "error"
        checks["status"] = "degraded"

    if settings.app_version:
        checks["app_version"] = settings.app_version
    if settings.environment:
        checks["environment"] = settings.environment

    return checks
