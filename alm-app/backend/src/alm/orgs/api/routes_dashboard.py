"""Org API routes: Dashboard."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Dashboard ──


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    stats = await mediator.query(GetOrgDashboardStats(tenant_id=org.tenant_id))
    return {
        "projects": stats.projects,
        "artifacts": stats.artifacts,
        "tasks": stats.tasks,
        "openDefects": stats.open_defects,
    }


@router.get("/dashboard/activity")
async def get_dashboard_activity(
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
    limit: int = 10,
) -> list[dict]:
    items = await mediator.query(GetOrgDashboardActivity(tenant_id=org.tenant_id, limit=min(limit, 50)))
    return [
        {
            "artifact_id": str(i.artifact_id),
            "project_id": str(i.project_id),
            "project_slug": i.project_slug,
            "title": i.title,
            "state": i.state,
            "artifact_type": i.artifact_type,
            "updated_at": i.updated_at.isoformat() if i.updated_at else None,
        }
        for i in items
    ]
