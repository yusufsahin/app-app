from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import AccessDenied, EntityNotFound
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    get_current_user,
    require_permission,
)
from alm.project.api.schemas import ProjectCreateRequest, ProjectResponse
from alm.project.application.commands.create_project import CreateProject
from alm.project.application.queries.get_project import GetProject
from alm.project.application.queries.list_projects import ListProjects

router = APIRouter(prefix="/{tenant_id}/projects", tags=["projects"])


def _ensure_tenant_access(user: CurrentUser, tenant_id: uuid.UUID) -> None:
    if user.tenant_id != tenant_id:
        raise AccessDenied("Cannot access projects of another tenant")


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    tenant_id: uuid.UUID,
    body: ProjectCreateRequest,
    user: CurrentUser = require_permission("project:create"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectResponse:
    _ensure_tenant_access(user, tenant_id)
    dto = await mediator.send(
        CreateProject(
            tenant_id=tenant_id,
            code=body.code,
            name=body.name,
            description=body.description,
            created_by=user.id,
        )
    )
    return ProjectResponse(
        id=dto.id,
        code=dto.code,
        name=dto.name,
        slug=dto.slug,
        description=dto.description,
    )


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    tenant_id: uuid.UUID,
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ProjectResponse]:
    _ensure_tenant_access(user, tenant_id)
    dtos = await mediator.query(ListProjects(tenant_id=tenant_id))
    return [
        ProjectResponse(
            id=d.id,
            code=d.code,
            name=d.name,
            slug=d.slug,
            description=d.description,
        )
        for d in dtos
    ]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectResponse:
    _ensure_tenant_access(user, tenant_id)
    dto = await mediator.query(
        GetProject(tenant_id=tenant_id, project_id=project_id)
    )
    if dto is None:
        raise EntityNotFound("Project", project_id)
    return ProjectResponse(
        id=dto.id,
        code=dto.code,
        name=dto.name,
        slug=dto.slug,
        description=dto.description,
    )
