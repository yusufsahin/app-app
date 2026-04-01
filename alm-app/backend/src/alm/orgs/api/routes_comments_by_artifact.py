"""Org API routes: Comments scoped by artifact."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/comments",
    response_model=list[CommentResponse],
)
async def list_comments_by_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[CommentResponse]:
    dtos = await mediator.query(
        ListCommentsByArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
    )
    return [
        CommentResponse(
            id=d.id,
            project_id=d.project_id,
            artifact_id=d.artifact_id,
            body=d.body,
            created_by=d.created_by,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in dtos
    ]


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/comments",
    response_model=CommentResponse,
    status_code=201,
)
async def create_comment(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: CommentCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:comment"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> CommentResponse:
    dto = await mediator.send(
        CreateComment(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            body=body.body,
            created_by=user.id,
        )
    )
    return CommentResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_id=dto.artifact_id,
        body=dto.body,
        created_by=dto.created_by,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )
