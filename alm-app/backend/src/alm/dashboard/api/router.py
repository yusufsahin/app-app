"""Dashboard API router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import AccessDenied
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    require_permission,
)
from alm.project.application.queries.list_projects import ListProjects


router = APIRouter(prefix="/{tenant_id}/dashboard", tags=["dashboard"])


def _ensure_tenant_access(user: CurrentUser, tenant_id: uuid.UUID) -> None:
    if user.tenant_id != tenant_id:
        raise AccessDenied("Cannot access dashboard of another tenant")


@router.get("/stats")
async def get_dashboard_stats(
    tenant_id: uuid.UUID,
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    """Return tenant-scoped dashboard stats. Projects count from DB; others placeholder."""
    _ensure_tenant_access(user, tenant_id)
    projects = await mediator.query(ListProjects(tenant_id=tenant_id))
    return {
        "projects": len(projects),
        "artifacts": 0,
        "tasks": 0,
        "openDefects": 0,
    }
