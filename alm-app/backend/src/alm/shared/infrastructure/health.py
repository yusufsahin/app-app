from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from alm.artifact.domain.mpc_facade import HAS_MPC
from alm.config.settings import settings
from alm.shared.infrastructure.db.session import engine
from alm.shared.infrastructure.outbox_queries import OUTBOX_AGGREGATE_ROW_COUNTS_SQL

health_router = APIRouter(tags=["health"])


@health_router.get("/health/live")
@health_router.get("/health/liveness")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@health_router.get("/health/ready")
async def readiness() -> dict[str, str | bool | int | None]:
    checks: dict[str, str | bool | int | None] = {"status": "ok"}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            pending_n: int | None = None
            exhausted_n: int | None = None
            try:
                res = await conn.execute(
                    text(OUTBOX_AGGREGATE_ROW_COUNTS_SQL),
                    {"max_attempts": settings.domain_event_outbox_max_attempts},
                )
                row = res.mappings().one()
                pending_n = int(row["total"])
                exhausted_n = int(row["exhausted"])
                checks["domain_event_outbox_pending"] = pending_n
                checks["domain_event_outbox_exhausted_rows"] = exhausted_n
            except ProgrammingError:
                checks["domain_event_outbox_pending"] = None
                checks["domain_event_outbox_exhausted_rows"] = None
                checks["domain_event_outbox_note"] = "table_missing_run_migrations"
            except Exception:
                checks["domain_event_outbox_pending"] = None
                checks["domain_event_outbox_exhausted_rows"] = None
                checks["domain_event_outbox_note"] = "pending_count_unavailable"

            if pending_n is not None:
                mx = settings.domain_event_outbox_readiness_max_pending
                if mx is not None:
                    checks["domain_event_outbox_readiness_max_pending"] = mx
                    if pending_n > mx:
                        checks["status"] = "degraded"
                        checks["domain_event_outbox_backlog"] = "above_threshold"
                if (
                    settings.domain_event_outbox_readiness_degrade_on_exhausted
                    and exhausted_n is not None
                    and exhausted_n > 0
                ):
                    checks["status"] = "degraded"
                    checks["domain_event_outbox_dead_letter"] = "present"
        checks["db"] = "ok"
    except Exception:
        checks["db"] = "error"
        checks["status"] = "degraded"

    if settings.app_version:
        checks["app_version"] = settings.app_version
    if settings.environment:
        checks["environment"] = settings.environment

    checks["mpc_installed"] = HAS_MPC
    checks["mpc_mode"] = settings.mpc_mode
    if settings.is_production and not HAS_MPC:
        checks["status"] = "degraded"
        checks["mpc_note"] = "MPC not installed; policy/ACL run in strict-deny mode in production"

    return checks
