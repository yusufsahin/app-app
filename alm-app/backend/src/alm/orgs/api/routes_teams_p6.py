"""Org API routes: Teams (P6)."""

from fastapi import APIRouter, Response

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Teams (P6) ──


def _team_dto_to_response(dto) -> TeamResponse:
    return TeamResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        description=dto.description,
        is_default=dto.is_default,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        members=[TeamMemberResponse(team_id=m.team_id, user_id=m.user_id, role=m.role) for m in (dto.members or [])],
    )


@router.get(
    "/projects/{project_id}/teams",
    response_model=list[TeamResponse],
)
async def list_teams(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[TeamResponse]:
    dtos = await mediator.query(ListTeamsByProject(tenant_id=org.tenant_id, project_id=project_id))
    return [_team_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/teams",
    response_model=TeamResponse,
    status_code=201,
)
async def create_team(
    project_id: uuid.UUID,
    body: TeamCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    dto = await mediator.send(
        CreateTeam(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            description=body.description,
        )
    )
    return _team_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/teams/{team_id}",
    response_model=TeamResponse,
)
async def get_team(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    dto = await mediator.query(GetTeam(tenant_id=org.tenant_id, project_id=project_id, team_id=team_id))
    if dto is None:
        raise EntityNotFound("Team", team_id)
    return _team_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/teams/{team_id}",
    response_model=TeamResponse,
)
async def update_team(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    body: TeamUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateTeam(
            tenant_id=org.tenant_id,
            project_id=project_id,
            team_id=team_id,
            name=updates.get("name"),
            description=updates.get("description"),
            is_default=updates.get("is_default"),
        )
    )
    return _team_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/teams/{team_id}",
    status_code=204, response_model=None, response_class=Response,
)
async def delete_team(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(DeleteTeam(tenant_id=org.tenant_id, project_id=project_id, team_id=team_id))


@router.post(
    "/projects/{project_id}/teams/{team_id}/members",
    response_model=TeamResponse,
)
async def add_team_member(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    body: AddTeamMemberRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    dto = await mediator.send(
        AddTeamMember(
            tenant_id=org.tenant_id,
            project_id=project_id,
            team_id=team_id,
            user_id=body.user_id,
            role=body.role,
        )
    )
    return _team_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/teams/{team_id}/members/{user_id}",
    response_model=TeamResponse,
)
async def remove_team_member(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    dto = await mediator.send(
        RemoveTeamMember(
            tenant_id=org.tenant_id,
            project_id=project_id,
            team_id=team_id,
            user_id=user_id,
        )
    )
    return _team_dto_to_response(dto)
