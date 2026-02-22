from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from alm.shared.infrastructure.db.session import engine

health_router = APIRouter(tags=["health"])


@health_router.get("/health/live")
@health_router.get("/health/liveness")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@health_router.get("/health/ready")
async def readiness() -> dict[str, str | bool]:
    checks: dict[str, str | bool] = {"status": "ok"}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception:
        checks["db"] = "error"
        checks["status"] = "degraded"

    return checks
