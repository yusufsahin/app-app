"""Org API routes: cadences (release/cycle planning tree)."""

from fastapi import APIRouter, Response

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Cadences (release/cycle planning tree) ──


def _cadence_dto_to_response(dto) -> CadenceResponse:
    children = [_cadence_dto_to_response(c) for c in getattr(dto, "children", []) or []]
    return CadenceResponse(
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
        type=getattr(dto, "type", "cycle") or "cycle",
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        children=children,
    )


@router.get(
    "/projects/{project_id}/cadences",
    response_model=list[CadenceResponse],
)
async def list_cadences(
    project_id: uuid.UUID,
    flat: bool = True,
    type: str | None = Query(None, description="Filter by type: release | cycle"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[CadenceResponse]:
    dtos = await mediator.query(
        ListCadencesByProject(
            tenant_id=org.tenant_id,
            project_id=project_id,
            flat=flat,
            type=type,
        )
    )
    return [_cadence_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/cadences",
    response_model=CadenceResponse,
    status_code=201,
)
async def create_cadence(
    project_id: uuid.UUID,
    body: CadenceCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> CadenceResponse:
    dto = await mediator.send(
        CreateCadence(
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
    return _cadence_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/cadences/{cadence_id}",
    response_model=CadenceResponse,
)
async def get_cadence(
    project_id: uuid.UUID,
    cadence_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> CadenceResponse:
    dto = await mediator.query(
        GetCadence(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cadence_id=cadence_id,
        )
    )
    if dto is None:
        raise EntityNotFound("Cadence", cadence_id)
    return _cadence_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/cadences/{cadence_id}",
    response_model=CadenceResponse,
)
async def update_cadence(
    project_id: uuid.UUID,
    cadence_id: uuid.UUID,
    body: CadenceUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> CadenceResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateCadence(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cadence_id=cadence_id,
            name=updates.get("name"),
            goal=updates.get("goal"),
            start_date=updates.get("start_date"),
            end_date=updates.get("end_date"),
            state=updates.get("state"),
            sort_order=updates.get("sort_order"),
            type=updates.get("type"),
        )
    )
    return _cadence_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/cadences/{cadence_id}",
    status_code=204, response_model=None, response_class=Response,
)
async def delete_cadence(
    project_id: uuid.UUID,
    cadence_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteCadence(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cadence_id=cadence_id,
        )
    )
