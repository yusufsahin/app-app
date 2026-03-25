"""Org API routes: Artifact links (traceability)."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Artifact links (traceability) ──


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/links",
    response_model=list[ArtifactLinkResponse],
)
async def list_artifact_links(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ArtifactLinkResponse]:
    dtos = await mediator.query(
        ListArtifactLinks(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
    )
    return [
        ArtifactLinkResponse(
            id=d.id,
            project_id=d.project_id,
            from_artifact_id=d.from_artifact_id,
            to_artifact_id=d.to_artifact_id,
            link_type=d.link_type,
            created_at=d.created_at,
        )
        for d in dtos
    ]


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/links",
    response_model=ArtifactLinkResponse,
    status_code=201,
)
async def create_artifact_link(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactLinkCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactLinkResponse:
    # When manifest defines link_types, validate body.link_type against them
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    if manifest_result and manifest_result.manifest_bundle:
        flat = manifest_defs_to_flat(manifest_result.manifest_bundle)
        allowed = flat.get("link_types") or []
        if allowed:
            allowed_ids = [str(lt.get("id", "")).lower() for lt in allowed if lt.get("id")]
            link_type_normalized = (body.link_type or "").strip().lower() or "related"
            if allowed_ids and link_type_normalized not in allowed_ids:
                raise HTTPException(
                    400,
                    detail=f"link_type must be one of: {', '.join(allowed_ids)}",
                )
    dto = await mediator.send(
        CreateArtifactLink(
            tenant_id=org.tenant_id,
            project_id=project_id,
            from_artifact_id=artifact_id,
            to_artifact_id=body.to_artifact_id,
            link_type=body.link_type,
        )
    )
    return ArtifactLinkResponse(
        id=dto.id,
        project_id=dto.project_id,
        from_artifact_id=dto.from_artifact_id,
        to_artifact_id=dto.to_artifact_id,
        link_type=dto.link_type,
        created_at=dto.created_at,
    )


@router.delete(
    "/projects/{project_id}/artifacts/{artifact_id}/links/{link_id}",
    status_code=204,
)
async def delete_artifact_link(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    link_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteArtifactLink(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            link_id=link_id,
        )
    )
