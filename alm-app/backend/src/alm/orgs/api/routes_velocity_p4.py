"""Org API routes: Velocity (P4)."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Velocity (P4) ──


class VelocityPointResponse(BaseModel):
    cycle_id: uuid.UUID
    cycle_name: str
    total_effort: float


@router.get(
    "/projects/{project_id}/velocity",
    response_model=list[VelocityPointResponse],
)
async def get_velocity(
    project_id: uuid.UUID,
    cycle_id: list[uuid.UUID] | None = Query(None),
    release_id: uuid.UUID | None = Query(None, description="Velocity for all cycles under this release"),
    last_n: int | None = Query(None, description="Last N cycles by order (if cycle_id not set)"),
    effort_field: str = Query("story_points", description="Custom field key for effort"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[VelocityPointResponse]:
    dtos = await mediator.query(
        GetVelocity(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_ids=cycle_id,
            release_id=release_id,
            last_n=last_n,
            effort_field=effort_field,
        )
    )
    return [
        VelocityPointResponse(
            cycle_id=d.cycle_id,
            cycle_name=d.cycle_name,
            total_effort=d.total_effort,
        )
        for d in dtos
    ]


class BurndownPointResponse(BaseModel):
    cycle_id: uuid.UUID
    cycle_name: str
    total_effort: float
    completed_effort: float
    remaining_effort: float


@router.get(
    "/projects/{project_id}/burndown",
    response_model=list[BurndownPointResponse],
)
async def get_burndown(
    project_id: uuid.UUID,
    cycle_id: list[uuid.UUID] | None = Query(None),
    last_n: int | None = Query(None, description="Last N cycles by order (if cycle_id not set)"),
    effort_field: str = Query("story_points", description="Custom field key for effort"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[BurndownPointResponse]:
    dtos = await mediator.query(
        GetBurndown(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_ids=cycle_id,
            last_n=last_n,
            effort_field=effort_field,
        )
    )
    return [
        BurndownPointResponse(
            cycle_id=d.cycle_id,
            cycle_name=d.cycle_name,
            total_effort=d.total_effort,
            completed_effort=d.completed_effort,
            remaining_effort=d.remaining_effort,
        )
        for d in dtos
    ]
