"""Team API router: project teams and memberships."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import AccessDenied, EntityNotFound
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    require_permission,
)
from alm.team.api.schemas import (
    AddTeamMemberRequest,
    TeamCreateRequest,
    TeamMemberResponse,
    TeamResponse,
    TeamUpdateRequest,
)
from alm.team.application.commands.add_team_member import AddTeamMember
from alm.team.application.commands.create_team import CreateTeam
from alm.team.application.commands.delete_team import DeleteTeam
from alm.team.application.commands.remove_team_member import RemoveTeamMember
from alm.team.application.commands.update_team import UpdateTeam
from alm.team.application.queries.get_team import GetTeam
from alm.team.application.queries.list_teams_by_project import ListTeamsByProject

router = APIRouter(prefix="/{tenant_id}/projects/{project_id}/teams", tags=["teams"])


def _ensure_tenant_access(user: CurrentUser, tenant_id: uuid.UUID) -> None:
    if user.tenant_id != tenant_id:
        raise AccessDenied("Cannot access teams of another tenant")


@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    body: TeamCreateRequest,
    user: CurrentUser = require_permission("team:create"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    _ensure_tenant_access(user, tenant_id)
    dto = await mediator.send(
        CreateTeam(
            tenant_id=tenant_id,
            project_id=project_id,
            name=body.name,
            description=body.description,
        )
    )
    return TeamResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        description=dto.description,
        is_default=dto.is_default,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        members=[
            TeamMemberResponse(team_id=m.team_id, user_id=m.user_id, role=m.role) for m in (dto.members or [])
        ],
    )


@router.get("/", response_model=list[TeamResponse])
async def list_teams(
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    user: CurrentUser = require_permission("team:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[TeamResponse]:
    _ensure_tenant_access(user, tenant_id)
    dtos = await mediator.query(ListTeamsByProject(tenant_id=tenant_id, project_id=project_id))
    return [
        TeamResponse(
            id=d.id,
            project_id=d.project_id,
            name=d.name,
            description=d.description,
            is_default=d.is_default,
            created_at=d.created_at,
            updated_at=d.updated_at,
            members=[
                TeamMemberResponse(team_id=m.team_id, user_id=m.user_id, role=m.role) for m in (d.members or [])
            ],
        )
        for d in dtos
    ]


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    user: CurrentUser = require_permission("team:read"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    _ensure_tenant_access(user, tenant_id)
    dto = await mediator.query(GetTeam(tenant_id=tenant_id, project_id=project_id, team_id=team_id))
    if dto is None:
        raise EntityNotFound("Team", team_id)
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


@router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    body: TeamUpdateRequest,
    user: CurrentUser = require_permission("team:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    _ensure_tenant_access(user, tenant_id)
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateTeam(
            tenant_id=tenant_id,
            project_id=project_id,
            team_id=team_id,
            name=updates.get("name"),
            description=updates.get("description"),
            is_default=updates.get("is_default"),
        )
    )
    return TeamResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        description=dto.description,
        is_default=dto.is_default,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        members=[
            TeamMemberResponse(team_id=m.team_id, user_id=m.user_id, role=m.role) for m in (dto.members or [])
        ],
    )


@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    response_class=Response,
)
async def delete_team(
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    user: CurrentUser = require_permission("team:delete"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    _ensure_tenant_access(user, tenant_id)
    await mediator.send(DeleteTeam(tenant_id=tenant_id, project_id=project_id, team_id=team_id))


@router.post("/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    body: AddTeamMemberRequest,
    user: CurrentUser = require_permission("team:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamMemberResponse:
    _ensure_tenant_access(user, tenant_id)
    dto = await mediator.send(
        AddTeamMember(
            tenant_id=tenant_id,
            project_id=project_id,
            team_id=team_id,
            user_id=body.user_id,
            role=body.role,
        )
    )
    return TeamMemberResponse(team_id=dto.team_id, user_id=dto.user_id, role=dto.role)


@router.delete(
    "/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    response_class=Response,
)
async def remove_team_member(
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    user: CurrentUser = require_permission("team:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    _ensure_tenant_access(user, tenant_id)
    await mediator.send(
        RemoveTeamMember(
            tenant_id=tenant_id,
            project_id=project_id,
            team_id=team_id,
            user_id=user_id,
        )
    )
