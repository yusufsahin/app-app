"""Org API routes: Attachments (artifact file upload/download)."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Attachments (artifact file upload/download) ──


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/attachments",
    response_model=list[AttachmentResponse],
)
async def list_attachments(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[AttachmentResponse]:
    dtos = await mediator.query(
        ListAttachmentsByArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
    )
    return [
        AttachmentResponse(
            id=d.id,
            project_id=d.project_id,
            artifact_id=d.artifact_id,
            file_name=d.file_name,
            content_type=d.content_type,
            size=d.size,
            created_by=d.created_by,
            created_at=d.created_at,
        )
        for d in dtos
    ]


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/attachments",
    response_model=AttachmentResponse,
    status_code=201,
)
async def upload_attachment(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    file: UploadFile = File(...),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> AttachmentResponse:
    content = await file.read()
    dto = await mediator.send(
        CreateAttachment(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            file_name=file.filename or "file",
            content_type=file.content_type or "application/octet-stream",
            file_content=content,
            created_by=user.id,
        )
    )
    return AttachmentResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_id=dto.artifact_id,
        file_name=dto.file_name,
        content_type=dto.content_type,
        size=dto.size,
        created_by=dto.created_by,
        created_at=dto.created_at,
    )


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/attachments/{attachment_id}",
    response_class=Response,
)
async def download_attachment(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    attachment_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
    storage: FileStoragePort = Depends(get_file_storage),
) -> Response:
    dto = await mediator.query(
        GetAttachment(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            attachment_id=attachment_id,
        )
    )
    if dto is None:
        raise EntityNotFound("Attachment", attachment_id)
    content = await storage.read(dto.storage_key)
    return Response(
        content=content,
        media_type=dto.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{dto.file_name}"',
            "Content-Length": str(len(content)),
        },
    )


@router.delete(
    "/projects/{project_id}/artifacts/{artifact_id}/attachments/{attachment_id}",
    status_code=204,
)
async def delete_attachment(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    attachment_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteAttachment(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            attachment_id=attachment_id,
        )
    )
