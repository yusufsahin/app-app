"""Org API routes: artifact relationships."""

from fastapi import APIRouter, Response

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()


def _project_manifest_bundle(
    manifest_result: object | None,
) -> dict | None:
    if manifest_result is None:
        return None
    bundle = getattr(manifest_result, "manifest_bundle", None)
    return bundle if isinstance(bundle, dict) else None


def _impact_node_response(
    node: ArtifactImpactAnalysisNodeDTO,
) -> ArtifactImpactAnalysisNodeResponse:
    return ArtifactImpactAnalysisNodeResponse(
        artifact_id=node.artifact_id,
        artifact_key=node.artifact_key,
        artifact_type=node.artifact_type,
        title=node.title,
        state=node.state,
        parent_id=node.parent_id,
        relationship_id=node.relationship_id,
        relationship_type=node.relationship_type,
        relationship_label=node.relationship_label,
        direction=node.direction,
        depth=node.depth,
        has_more=node.has_more,
        hierarchy_path=[
            ImpactHierarchyRefResponse(
                id=ref.id,
                artifact_key=ref.artifact_key,
                title=ref.title,
                artifact_type=ref.artifact_type,
            )
            for ref in node.hierarchy_path
        ],
        children=[_impact_node_response(child) for child in node.children],
    )


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/relationships",
    response_model=list[ArtifactRelationshipResponse],
)
async def list_artifact_relationships(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ArtifactRelationshipResponse]:
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    bundle = _project_manifest_bundle(manifest_result)
    dtos = await mediator.query(
        ListRelationshipsForArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            manifest_bundle=bundle,
        )
    )
    return [
        ArtifactRelationshipResponse(
            id=d.id,
            project_id=d.project_id,
            source_artifact_id=d.source_artifact_id,
            target_artifact_id=d.target_artifact_id,
            other_artifact_id=d.other_artifact_id,
            other_artifact_type=d.other_artifact_type,
            other_artifact_key=d.other_artifact_key,
            other_artifact_title=d.other_artifact_title,
            relationship_type=d.relationship_type,
            direction=d.direction,
            category=d.category,
            display_label=d.display_label,
            created_at=d.created_at,
            sort_order=d.sort_order,
        )
        for d in dtos
    ]


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/relationships/impact-analysis",
    response_model=ArtifactImpactAnalysisResponse,
)
async def get_artifact_impact_analysis(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    direction: str = Query(default="both"),
    depth: int = Query(default=2, ge=0, le=5),
    relationship_types: str | None = Query(default=None),
    include_hierarchy: bool = Query(default=True),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactImpactAnalysisResponse:
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    bundle = _project_manifest_bundle(manifest_result)
    parsed_types = tuple(
        item.strip().lower()
        for item in (relationship_types or "impacts,blocks").split(",")
        if item.strip()
    )
    result = await mediator.query(
        GetArtifactImpactAnalysis(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            direction=direction,
            depth=depth,
            relationship_types=parsed_types,
            include_hierarchy=include_hierarchy,
            manifest_bundle=bundle,
        )
    )
    return ArtifactImpactAnalysisResponse(
        focus_artifact=artifact_response_from_dto(result.focus_artifact),
        trace_from=[_impact_node_response(node) for node in result.trace_from],
        trace_to=[_impact_node_response(node) for node in result.trace_to],
        applied_relationship_types=list(result.applied_relationship_types),
        depth=result.depth,
    )


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/relationships/options",
    response_model=list[RelationshipTypeOptionResponse],
)
async def list_relationship_options(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[RelationshipTypeOptionResponse]:
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    bundle = _project_manifest_bundle(manifest_result)
    dtos = await mediator.query(
        ListRelationshipTypeOptions(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            manifest_bundle=bundle,
        )
    )
    return [
        RelationshipTypeOptionResponse(
            key=d.key,
            label=d.label,
            reverse_label=d.reverse_label,
            category=d.category,
            directionality=d.directionality,
            allowed_target_types=list(d.allowed_target_types),
            description=d.description,
        )
        for d in dtos
    ]


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/relationships",
    response_model=ArtifactRelationshipResponse,
    status_code=201,
)
async def create_artifact_relationship(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactRelationshipCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactRelationshipResponse:
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    bundle = _project_manifest_bundle(manifest_result)
    dto = await mediator.send(
        CreateRelationship(
            tenant_id=org.tenant_id,
            project_id=project_id,
            source_artifact_id=artifact_id,
            target_artifact_id=body.target_artifact_id,
            relationship_type=body.relationship_type,
            manifest_bundle=bundle,
        )
    )
    views = await mediator.query(
        ListRelationshipsForArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            manifest_bundle=bundle,
        )
    )
    view = next((item for item in views if item.id == dto.id), None)
    if view is None:
        raise HTTPException(status_code=500, detail="Relationship created but could not be reloaded")
    return ArtifactRelationshipResponse(
        id=view.id,
        project_id=view.project_id,
        source_artifact_id=view.source_artifact_id,
        target_artifact_id=view.target_artifact_id,
        other_artifact_id=view.other_artifact_id,
        other_artifact_type=view.other_artifact_type,
        other_artifact_key=view.other_artifact_key,
        other_artifact_title=view.other_artifact_title,
        relationship_type=view.relationship_type,
        direction=view.direction,
        category=view.category,
        display_label=view.display_label,
        created_at=view.created_at,
        sort_order=view.sort_order,
    )


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/relationships/bulk",
    response_model=ArtifactRelationshipBulkResultResponse,
    status_code=200,
)
async def bulk_create_artifact_relationships(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactRelationshipBulkCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactRelationshipBulkResultResponse:
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    bundle = _project_manifest_bundle(manifest_result)
    succeeded: list[uuid.UUID] = []
    failed: list[ArtifactRelationshipBulkResultItem] = []

    for target_id in body.target_artifact_ids:
        try:
            await mediator.send(
                CreateRelationship(
                    tenant_id=org.tenant_id,
                    project_id=project_id,
                    source_artifact_id=artifact_id,
                    target_artifact_id=target_id,
                    relationship_type=body.relationship_type,
                    manifest_bundle=bundle,
                )
            )
            succeeded.append(target_id)
        except ValidationError as exc:
            detail = str(exc)
            if "already exists" in detail.lower():
                succeeded.append(target_id)
            else:
                failed.append(ArtifactRelationshipBulkResultItem(id=target_id, reason=detail))

    return ArtifactRelationshipBulkResultResponse(succeeded=succeeded, failed=failed)


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/relationships/bulk-delete",
    response_model=ArtifactRelationshipBulkResultResponse,
    status_code=200,
)
async def bulk_delete_artifact_relationships(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactRelationshipBulkDeleteRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactRelationshipBulkResultResponse:
    succeeded: list[uuid.UUID] = []
    failed: list[ArtifactRelationshipBulkResultItem] = []

    for relationship_id in body.relationship_ids:
        try:
            await mediator.send(
                DeleteRelationship(
                    tenant_id=org.tenant_id,
                    project_id=project_id,
                    artifact_id=artifact_id,
                    relationship_id=relationship_id,
                )
            )
            succeeded.append(relationship_id)
        except ValidationError as exc:
            failed.append(ArtifactRelationshipBulkResultItem(id=relationship_id, reason=str(exc)))

    return ArtifactRelationshipBulkResultResponse(succeeded=succeeded, failed=failed)


@router.patch(
    "/projects/{project_id}/artifacts/{artifact_id}/relationships/reorder",
    status_code=204, response_model=None, response_class=Response,
)
async def reorder_artifact_relationships(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactRelationshipReorderRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    bundle = _project_manifest_bundle(manifest_result)
    try:
        await mediator.send(
            ReorderOutgoingRelationships(
                tenant_id=org.tenant_id,
                project_id=project_id,
                source_artifact_id=artifact_id,
                relationship_type=body.relationship_type,
                ordered_relationship_ids=body.ordered_relationship_ids,
                manifest_bundle=bundle,
            )
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/projects/{project_id}/artifacts/{artifact_id}/relationships/{relationship_id}",
    status_code=204, response_model=None, response_class=Response,
)
async def delete_artifact_relationship(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    relationship_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteRelationship(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            relationship_id=relationship_id,
        )
    )
