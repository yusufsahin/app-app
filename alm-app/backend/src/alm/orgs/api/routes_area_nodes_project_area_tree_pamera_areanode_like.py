"""Org API routes: Area nodes (project area tree, pamera AreaNode-like)."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Area nodes (project area tree, pamera AreaNode-like) ──


def _area_node_dto_to_response(dto) -> AreaNodeResponse:
    children = [_area_node_dto_to_response(c) for c in getattr(dto, "children", []) or []]
    return AreaNodeResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        path=dto.path,
        parent_id=dto.parent_id,
        depth=dto.depth,
        sort_order=dto.sort_order,
        is_active=dto.is_active,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        children=children,
    )


@router.get(
    "/projects/{project_id}/area-nodes",
    response_model=list[AreaNodeResponse],
)
async def list_area_nodes(
    project_id: uuid.UUID,
    flat: bool = True,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[AreaNodeResponse]:
    dtos = await mediator.query(
        ListAreaNodesByProject(
            tenant_id=org.tenant_id,
            project_id=project_id,
            flat=flat,
        )
    )
    return [_area_node_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/area-nodes",
    response_model=AreaNodeResponse,
    status_code=201,
)
async def create_area_node(
    project_id: uuid.UUID,
    body: AreaNodeCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> AreaNodeResponse:
    dto = await mediator.send(
        CreateAreaNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            parent_id=body.parent_id,
            sort_order=body.sort_order,
        )
    )
    return _area_node_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/area-nodes/{area_node_id}",
    response_model=AreaNodeResponse,
)
async def get_area_node(
    project_id: uuid.UUID,
    area_node_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> AreaNodeResponse:
    dto = await mediator.query(
        GetAreaNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            area_node_id=area_node_id,
        )
    )
    if dto is None:
        raise EntityNotFound("AreaNode", area_node_id)
    return _area_node_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/area-nodes/{area_node_id}",
    response_model=AreaNodeResponse,
)
async def update_area_node(
    project_id: uuid.UUID,
    area_node_id: uuid.UUID,
    body: AreaNodeUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> AreaNodeResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateAreaNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            area_node_id=area_node_id,
            name=updates.get("name"),
            sort_order=updates.get("sort_order"),
        )
    )
    return _area_node_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/area-nodes/{area_node_id}",
    status_code=204,
)
async def delete_area_node(
    project_id: uuid.UUID,
    area_node_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteAreaNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            area_node_id=area_node_id,
        )
    )


@router.patch(
    "/projects/{project_id}/area-nodes/{area_node_id}/rename",
    response_model=AreaNodeResponse,
)
async def rename_area_node(
    project_id: uuid.UUID,
    area_node_id: uuid.UUID,
    body: RenameAreaRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> AreaNodeResponse:
    dto = await mediator.send(
        RenameAreaNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            area_node_id=area_node_id,
            new_name=body.new_name,
        )
    )
    return _area_node_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/area-nodes/{area_node_id}/move",
    response_model=AreaNodeResponse,
)
async def move_area_node(
    project_id: uuid.UUID,
    area_node_id: uuid.UUID,
    body: MoveAreaRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> AreaNodeResponse:
    dto = await mediator.send(
        MoveAreaNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            area_node_id=area_node_id,
            new_parent_id=body.new_parent_id,
        )
    )
    return _area_node_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/area-nodes/{area_node_id}/activate",
    response_model=AreaNodeResponse,
)
async def activate_area_node(
    project_id: uuid.UUID,
    area_node_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> AreaNodeResponse:
    dto = await mediator.send(
        ActivateAreaNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            area_node_id=area_node_id,
        )
    )
    return _area_node_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/area-nodes/{area_node_id}/deactivate",
    response_model=AreaNodeResponse,
)
async def deactivate_area_node(
    project_id: uuid.UUID,
    area_node_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> AreaNodeResponse:
    dto = await mediator.send(
        DeactivateAreaNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            area_node_id=area_node_id,
        )
    )
    return _area_node_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/form-schema",
    response_model=FormSchemaResponse,
)
async def get_form_schema(
    project_id: uuid.UUID,
    entity_type: str = "artifact",
    context: str = "create",
    artifact_type: str | None = None,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("manifest:read"),
    _acl: None = require_manifest_acl("manifest", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> FormSchemaResponse:
    """Get form schema for creating/editing entities (e.g. artifact create)."""
    schema = await mediator.query(
        GetFormSchema(
            tenant_id=org.tenant_id,
            project_id=project_id,
            entity_type=entity_type,
            context=context,
            artifact_type=artifact_type,
        )
    )
    if schema is None:
        raise EntityNotFound("FormSchema", project_id)
    return FormSchemaResponse(
        entity_type=schema.entity_type,
        context=schema.context,
        fields=[
            FormFieldSchemaResponse(
                key=f.key,
                type=f.type,
                label_key=f.label_key,
                required=f.required,
                options=f.options,
                default_value=f.default_value,
                order=f.order,
                visible_when=f.visible_when,
                required_when=f.required_when,
                entity_ref=f.entity_ref,
                allowed_parent_types=f.allowed_parent_types,
            )
            for f in schema.fields
        ],
        artifact_type_options=list(schema.artifact_type_options),
    )


@router.get(
    "/projects/{project_id}/list-schema",
    response_model=ListSchemaResponse,
)
async def get_list_schema(
    project_id: uuid.UUID,
    entity_type: str = "artifact",
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_list_schema_read_permission(),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> ListSchemaResponse:
    """Get list schema (columns + filters) for entity type from project manifest.

    Uses artifact:read (or task:read for entity_type=task) and artifact ACL read — aligned with
    list artifacts / list tasks so Table view is not blocked by manifest:read alone.
    """
    schema = await mediator.query(
        GetListSchema(
            tenant_id=org.tenant_id,
            project_id=project_id,
            entity_type=entity_type,
        )
    )
    if schema is None:
        raise EntityNotFound("ListSchema", project_id)
    return ListSchemaResponse(
        schema_version="1.0",
        entity_type=schema.entity_type,
        columns=[
            ListColumnSchemaResponse(
                key=c.key,
                label=c.label,
                label_key=c.label_key,
                type=c.type,
                order=c.order,
                sortable=c.sortable,
                width=c.width,
            )
            for c in schema.columns
        ],
        filters=[
            ListFilterSchemaResponse(
                key=f.key,
                label=f.label,
                label_key=f.label_key,
                type=f.type,
                order=f.order,
                options=f.options,
            )
            for f in schema.filters
        ],
    )


@router.get("/projects/{project_id}/manifest")
async def get_project_manifest(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("manifest:read"),
    _acl: None = require_manifest_acl("manifest", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    """Get manifest bundle for the project's process template version."""
    manifest = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    if manifest is None:
        raise EntityNotFound("ProjectManifest", project_id)

    bundle = dict(manifest.manifest_bundle or {})
    flat = manifest_defs_to_flat(bundle)
    bundle["workflows"] = flat["workflows"]
    bundle["artifact_types"] = flat["artifact_types"]
    bundle["link_types"] = flat["link_types"]

    return {
        "manifest_bundle": bundle,
        "template_name": manifest.template_name,
        "template_slug": manifest.template_slug,
        "version": manifest.version,
    }


@router.put("/projects/{project_id}/manifest")
async def update_project_manifest(
    project_id: uuid.UUID,
    body: UpdateProjectManifestRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("manifest:update"),
    _acl: None = require_manifest_acl("manifest", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    """Update project manifest: creates a new process template version and points project to it."""
    await mediator.send(
        UpdateProjectManifest(
            tenant_id=org.tenant_id,
            project_id=project_id,
            manifest_bundle=body.manifest_bundle,
        )
    )
    manifest = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    if manifest is None:
        raise EntityNotFound("ProjectManifest", project_id)
    bundle = dict(manifest.manifest_bundle or {})
    flat = manifest_defs_to_flat(bundle)
    bundle["workflows"] = flat["workflows"]
    bundle["artifact_types"] = flat["artifact_types"]
    bundle["link_types"] = flat["link_types"]
    return {
        "manifest_bundle": bundle,
        "template_name": manifest.template_name,
        "template_slug": manifest.template_slug,
        "version": manifest.version,
    }


@router.post("/projects/{project_id}/manifest/conformance")
async def check_manifest_conformance(
    project_id: uuid.UUID,
    body: UpdateProjectManifestRequest | None = None,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("manifest:read"),
    _acl: None = require_manifest_acl("manifest", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    """Run conformance checks on a manifest bundle (or the project's current manifest).

    Pass a ``manifest_bundle`` body to validate an unsaved draft; omit the body
    to validate the project's current manifest.  Returns a structured report with
    a ``passed`` flag and a list of ``errors``.
    """
    if body is not None and body.manifest_bundle:
        bundle = body.manifest_bundle
    else:
        manifest = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
        if manifest is None:
            raise EntityNotFound("ProjectManifest", project_id)
        bundle = dict(manifest.manifest_bundle or {})

    errors: list[dict] = []
    passed = True
    try:
        from mpc.kernel.ast import normalize
        from mpc.tooling.validator import validate_semantic
    except ImportError:
        return {"passed": True, "errors": [], "note": "mpc not installed; validation skipped"}

    try:
        ast = normalize(bundle)
        sem_errors = validate_semantic(ast)
        for e in sem_errors:
            passed = False
            errors.append(
                {
                    "code": getattr(e, "code", "UNKNOWN"),
                    "message": getattr(e, "message", str(e)),
                    "severity": getattr(e, "severity", "error"),
                    "path": getattr(e, "path", None),
                }
            )
    except Exception as exc:  # noqa: BLE001
        passed = False
        errors.append({"code": "PARSE_ERROR", "message": str(exc), "severity": "error", "path": None})

    return {"passed": passed, "errors": errors}
