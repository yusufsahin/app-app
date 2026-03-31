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
            sort_order=d.sort_order,
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
        sort_order=dto.sort_order,
    )


@router.patch(
    "/projects/{project_id}/artifacts/{artifact_id}/links/reorder",
    status_code=204,
)
async def reorder_artifact_links(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactLinkReorderRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    try:
        await mediator.send(
            ReorderOutgoingArtifactLinks(
                tenant_id=org.tenant_id,
                project_id=project_id,
                from_artifact_id=artifact_id,
                link_type=body.link_type,
                ordered_link_ids=body.ordered_link_ids,
            )
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/links/bulk",
    response_model=ArtifactLinkBulkResultResponse,
    status_code=200,
)
async def bulk_create_artifact_links(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactLinkBulkCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactLinkBulkResultResponse:
    succeeded: list[uuid.UUID] = []
    failed: list[ArtifactLinkBulkResultItem] = []

    # validate link type via manifest when restricted
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    if manifest_result and manifest_result.manifest_bundle:
        flat = manifest_defs_to_flat(manifest_result.manifest_bundle)
        allowed = flat.get("link_types") or []
        if allowed:
            allowed_ids = [str(lt.get("id", "")).lower() for lt in allowed if lt.get("id")]
            link_type_normalized = (body.link_type or "").strip().lower() or "related"
            if allowed_ids and link_type_normalized not in allowed_ids:
                raise HTTPException(400, detail=f"link_type must be one of: {', '.join(allowed_ids)}")

    for target_id in body.to_artifact_ids:
        try:
            await mediator.send(
                CreateArtifactLink(
                    tenant_id=org.tenant_id,
                    project_id=project_id,
                    from_artifact_id=artifact_id,
                    to_artifact_id=target_id,
                    link_type=body.link_type,
                )
            )
            succeeded.append(target_id)
        except ValidationError as exc:
            detail = str(exc)
            # Treat duplicate link as successful for idempotent bulk behavior.
            if "already exists" in detail.lower():
                succeeded.append(target_id)
            else:
                failed.append(ArtifactLinkBulkResultItem(id=target_id, reason=detail))

    return ArtifactLinkBulkResultResponse(succeeded=succeeded, failed=failed)


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/links/bulk-delete",
    response_model=ArtifactLinkBulkResultResponse,
    status_code=200,
)
async def bulk_delete_artifact_links(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactLinkBulkDeleteRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactLinkBulkResultResponse:
    succeeded: list[uuid.UUID] = []
    failed: list[ArtifactLinkBulkResultItem] = []

    for link_id in body.link_ids:
        try:
            await mediator.send(
                DeleteArtifactLink(
                    tenant_id=org.tenant_id,
                    project_id=project_id,
                    artifact_id=artifact_id,
                    link_id=link_id,
                )
            )
            succeeded.append(link_id)
        except ValidationError as exc:
            failed.append(ArtifactLinkBulkResultItem(id=link_id, reason=str(exc)))

    return ArtifactLinkBulkResultResponse(succeeded=succeeded, failed=failed)
