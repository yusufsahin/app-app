"""Org API routes: Capacity (hybrid team/user ownership)."""

from fastapi import APIRouter, Response

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()


@router.get(
    "/projects/{project_id}/capacity",
    response_model=list[CapacityResponse],
)
async def list_capacity(
    project_id: uuid.UUID,
    cycle_id: uuid.UUID | None = Query(None),
    team_id: uuid.UUID | None = Query(None),
    user_id: uuid.UUID | None = Query(None),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[CapacityResponse]:
    dtos = await mediator.query(
        ListCapacityByProject(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_id=cycle_id,
            team_id=team_id,
            user_id=user_id,
        )
    )
    return [capacity_response_from_dto(d) for d in dtos]


@router.post(
    "/projects/{project_id}/capacity",
    response_model=CapacityResponse,
    status_code=201,
)
async def create_capacity(
    project_id: uuid.UUID,
    body: CapacityCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> CapacityResponse:
    dto = await mediator.send(
        CreateCapacity(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_id=body.cycle_id,
            team_id=body.team_id,
            user_id=body.user_id,
            capacity_value=body.capacity_value,
            unit=body.unit,
        )
    )
    return capacity_response_from_dto(dto)


@router.patch(
    "/projects/{project_id}/capacity/{capacity_id}",
    response_model=CapacityResponse,
)
async def update_capacity(
    project_id: uuid.UUID,
    capacity_id: uuid.UUID,
    body: CapacityUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> CapacityResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateCapacity(
            tenant_id=org.tenant_id,
            project_id=project_id,
            capacity_id=capacity_id,
            cycle_id=updates.get("cycle_id"),
            team_id=updates.get("team_id"),
            user_id=updates.get("user_id"),
            capacity_value=updates.get("capacity_value"),
            unit=updates.get("unit"),
        )
    )
    return capacity_response_from_dto(dto)


@router.delete(
    "/projects/{project_id}/capacity/{capacity_id}",
    status_code=204, response_model=None, response_class=Response,
)
async def delete_capacity(
    project_id: uuid.UUID,
    capacity_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteCapacity(
            tenant_id=org.tenant_id,
            project_id=project_id,
            capacity_id=capacity_id,
        )
    )

