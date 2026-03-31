"""Org API routes: project work-item tags (ADO-style vocabulary)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403
from alm.project_tag.api.schemas import (
    ProjectTagCreateRequest,
    ProjectTagRenameRequest,
    ProjectTagResponse,
)

router = APIRouter()


def _tag_dto_to_response(dto) -> ProjectTagResponse:
    return ProjectTagResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


@router.get(
    "/projects/{project_id}/tags",
    response_model=list[ProjectTagResponse],
)
async def list_project_tags(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ProjectTagResponse]:
    dtos = await mediator.query(ListProjectTags(tenant_id=org.tenant_id, project_id=project_id))
    return [_tag_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/tags",
    response_model=ProjectTagResponse,
    status_code=201,
)
async def create_project_tag(
    project_id: uuid.UUID,
    body: ProjectTagCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectTagResponse:
    dto = await mediator.send(
        CreateProjectTag(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
        )
    )
    return _tag_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/tags/{tag_id}",
    response_model=ProjectTagResponse,
)
async def rename_project_tag(
    project_id: uuid.UUID,
    tag_id: uuid.UUID,
    body: ProjectTagRenameRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectTagResponse:
    dto = await mediator.send(
        RenameProjectTag(
            tenant_id=org.tenant_id,
            project_id=project_id,
            tag_id=tag_id,
            name=body.name,
        )
    )
    return _tag_dto_to_response(dto)


@router.delete("/projects/{project_id}/tags/{tag_id}", status_code=204)
async def delete_project_tag(
    project_id: uuid.UUID,
    tag_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteProjectTag(
            tenant_id=org.tenant_id,
            project_id=project_id,
            tag_id=tag_id,
        )
    )
