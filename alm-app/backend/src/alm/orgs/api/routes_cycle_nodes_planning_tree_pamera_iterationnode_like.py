"""Org API routes: Cycle nodes (planning tree, pamera IterationNode-like)."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Cycle nodes (planning tree, pamera IterationNode-like) ──


def _increment_dto_to_response(dto) -> IncrementResponse:
    children = [_increment_dto_to_response(c) for c in getattr(dto, "children", []) or []]
    return IncrementResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        path=dto.path,
        parent_id=dto.parent_id,
        depth=dto.depth,
        sort_order=dto.sort_order,
        goal=dto.goal,
        start_date=dto.start_date,
        end_date=dto.end_date,
        state=dto.state,
        type=getattr(dto, "type", "iteration") or "iteration",
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        children=children,
    )


@router.get(
    "/projects/{project_id}/increments",
    response_model=list[IncrementResponse],
)
async def list_cycle_nodes(
    project_id: uuid.UUID,
    flat: bool = True,
    type: str | None = Query(None, description="Filter by type: release | iteration"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[IncrementResponse]:
    dtos = await mediator.query(
        ListIncrementsByProject(
            tenant_id=org.tenant_id,
            project_id=project_id,
            flat=flat,
            type=type,
        )
    )
    return [_increment_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/increments",
    response_model=IncrementResponse,
    status_code=201,
)
async def create_cycle_node(
    project_id: uuid.UUID,
    body: IncrementCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> IncrementResponse:
    dto = await mediator.send(
        CreateIncrement(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            parent_id=body.parent_id,
            sort_order=body.sort_order,
            goal=body.goal,
            start_date=body.start_date,
            end_date=body.end_date,
            state=body.state,
            type=body.type,
        )
    )
    return _increment_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/increments/{cycle_node_id}",
    response_model=IncrementResponse,
)
async def get_cycle_node(
    project_id: uuid.UUID,
    cycle_node_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> IncrementResponse:
    dto = await mediator.query(
        GetIncrement(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_node_id=cycle_node_id,
        )
    )
    if dto is None:
        raise EntityNotFound("Increment", cycle_node_id)
    return _increment_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/increments/{cycle_node_id}",
    response_model=IncrementResponse,
)
async def update_cycle_node(
    project_id: uuid.UUID,
    cycle_node_id: uuid.UUID,
    body: IncrementUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> IncrementResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateIncrement(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_node_id=cycle_node_id,
            name=updates.get("name"),
            goal=updates.get("goal"),
            start_date=updates.get("start_date"),
            end_date=updates.get("end_date"),
            state=updates.get("state"),
            sort_order=updates.get("sort_order"),
            type=updates.get("type"),
        )
    )
    return _increment_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/increments/{cycle_node_id}",
    status_code=204,
)
async def delete_cycle_node(
    project_id: uuid.UUID,
    cycle_node_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteIncrement(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_node_id=cycle_node_id,
        )
    )
