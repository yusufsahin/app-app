"""Org API routes: Projects."""

from typing import Literal

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from alm.artifact.api.schemas import ArtifactImportResponse, ArtifactImportResponseRow
from alm.artifact.application.import_export_service import export_artifacts, export_import_template, import_artifacts
from alm.orgs.api._router_deps import *  # noqa: F403
from alm.project.api.project_response import project_dto_to_response

router = APIRouter()

@router.get("/projects/{project_id}/artifacts/export")
async def export_artifacts_file(
    project_id: uuid.UUID,
    format: Literal["csv", "xlsx"] = Query("csv"),
    scope: Literal["generic", "testcases", "runs"] = Query("generic"),
    state: str | None = None,
    type: str | None = None,
    q: str | None = None,
    cycle_id: uuid.UUID | None = None,
    release_id: uuid.UUID | None = Query(None, description="Filter by release (all cycles under this node)"),
    area_node_id: uuid.UUID | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    include_deleted: bool = False,
    include_system_roots: bool = False,
    tree: str | None = None,
    parent_id: uuid.UUID | None = Query(None),
    tag_id: uuid.UUID | None = Query(None),
    team_id: uuid.UUID | None = Query(None),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    session: AsyncSession = Depends(get_db),
) -> Response:
    result = await export_artifacts(
        session,
        project_id=project_id,
        format=format,
        scope=scope,
        state=state,
        type_filter=type,
        q=q,
        cycle_id=cycle_id,
        release_id=release_id,
        area_node_id=area_node_id,
        sort_by=sort_by,
        sort_order=sort_order,
        include_deleted=include_deleted,
        include_system_roots=include_system_roots,
        tree=tree,
        parent_id=parent_id,
        tag_id=tag_id,
        team_id=team_id,
    )
    return Response(
        content=result.content,
        media_type=result.content_type,
        headers={"Content-Disposition": f'attachment; filename="{result.filename}"'},
    )


@router.get("/projects/{project_id}/artifacts/import-template")
async def export_artifacts_import_template(
    project_id: uuid.UUID,
    format: Literal["csv", "xlsx"] = Query("csv"),
    scope: Literal["generic", "testcases"] = Query("generic"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
) -> Response:
    _ = (project_id, org, user)
    result = await export_import_template(format=format, scope=scope)
    return Response(
        content=result.content,
        media_type=result.content_type,
        headers={"Content-Disposition": f'attachment; filename="{result.filename}"'},
    )


@router.post("/projects/{project_id}/artifacts/import", response_model=ArtifactImportResponse)
async def import_artifacts_file(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    mode: Literal["create", "update", "upsert"] = Query("upsert"),
    scope: Literal["generic", "testcases"] = Query("generic"),
    validate_only: bool = Query(False),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    session: AsyncSession = Depends(get_db),
) -> ArtifactImportResponse:
    payload = await file.read()
    result = await import_artifacts(
        session,
        tenant_id=org.tenant_id,
        project_id=project_id,
        actor_id=user.id,
        filename=file.filename or "upload.csv",
        payload=payload,
        scope=scope,
        mode=mode,
        validate_only=validate_only,
    )
    return ArtifactImportResponse(
        created_count=result.created_count,
        updated_count=result.updated_count,
        validated_count=result.validated_count,
        skipped_count=result.skipped_count,
        failed_count=result.failed_count,
        rows=[
            ArtifactImportResponseRow(
                row_number=row.row_number,
                sheet=row.sheet,
                artifact_key=row.artifact_key,
                status=row.status,
                message=row.message,
                artifact_id=row.artifact_id,
            )
            for row in result.rows
        ],
    )


# ── Projects ──


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:create"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectResponse:
    dto = await mediator.send(
        CreateProject(
            tenant_id=org.tenant_id,
            code=body.code,
            name=body.name,
            description=body.description,
            process_template_slug=body.process_template_slug,
            created_by=user.id,
        )
    )
    return project_dto_to_response(dto)


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ProjectResponse]:
    dtos = await mediator.query(ListProjects(tenant_id=org.tenant_id))
    return [project_dto_to_response(d) for d in dtos]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectResponse:
    dto = await mediator.query(GetProject(tenant_id=org.tenant_id, project_id=project_id))
    if dto is None:
        raise EntityNotFound("Project", project_id)
    return project_dto_to_response(dto)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    body: UpdateProjectRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user=require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectResponse:
    data = body.model_dump(exclude_unset=True)
    if "metadata" in data:
        data["metadata_"] = data.pop("metadata")
    dto = await mediator.send(
        UpdateProject(
            tenant_id=org.tenant_id,
            project_id=project_id,
            **data,
        )
    )
    return project_dto_to_response(dto)


@router.get("/projects/{project_id}/members", response_model=list[ProjectMemberResponse])
async def list_project_members(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user=require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ProjectMemberResponse]:
    members = await mediator.query(ListProjectMembers(tenant_id=org.tenant_id, project_id=project_id))
    return [ProjectMemberResponse(id=m.id, project_id=m.project_id, user_id=m.user_id, role=m.role) for m in members]


@router.post(
    "/projects/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=201,
)
async def add_project_member(
    project_id: uuid.UUID,
    body: AddProjectMemberRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user=require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectMemberResponse:
    member = await mediator.send(
        AddProjectMember(
            tenant_id=org.tenant_id,
            project_id=project_id,
            user_id=body.user_id,
            role=body.role,
        )
    )
    return ProjectMemberResponse(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role,
    )


@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
async def remove_project_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user=require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    deleted = await mediator.send(
        RemoveProjectMember(
            tenant_id=org.tenant_id,
            project_id=project_id,
            user_id=user_id,
        )
    )
    if not deleted:
        raise EntityNotFound("ProjectMember", f"{project_id}:{user_id}")


@router.patch(
    "/projects/{project_id}/members/{user_id}",
    response_model=ProjectMemberResponse,
)
async def update_project_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    body: UpdateProjectMemberRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user=require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> ProjectMemberResponse:
    member = await mediator.send(
        UpdateProjectMember(
            tenant_id=org.tenant_id,
            project_id=project_id,
            user_id=user_id,
            role=body.role,
        )
    )
    return ProjectMemberResponse(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role,
    )


@router.get("/projects/{project_id}/artifacts", response_model=ArtifactListResponse)
async def list_artifacts(
    project_id: uuid.UUID,
    state: str | None = None,
    type: str | None = None,
    q: str | None = None,
    cycle_id: uuid.UUID | None = None,
    release_id: uuid.UUID | None = Query(
        None, description="Filter by release (all cycles under this node)"
    ),
    area_node_id: uuid.UUID | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    limit: int = 20,
    offset: int = 0,
    include_deleted: bool = False,
    include_system_roots: bool = False,
    tree: str | None = None,
    parent_id: uuid.UUID | None = Query(
        None,
        description="When set, return only artifacts whose parent_id equals this id (still scoped by tree subtree when tree is set).",
    ),
    tag_id: uuid.UUID | None = Query(None, description="Filter artifacts that have this project tag"),
    team_id: uuid.UUID | None = Query(None, description="Filter artifacts assigned to this team"),
    assignee_id: uuid.UUID | None = Query(None, description="Filter artifacts assigned to this user"),
    unassigned_only: bool = Query(
        False,
        description="When true, return only artifacts with no assignee (ignores assignee_id)",
    ),
    stale_traceability_only: bool = Query(
        False,
        description="When true, return only artifacts with stale_traceability=true (S4b).",
    ),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactListResponse:
    result = await mediator.query(
        ListArtifacts(
            tenant_id=org.tenant_id,
            project_id=project_id,
            state_filter=state,
            type_filter=type,
            search_query=q,
            cycle_id=cycle_id,
            release_id=release_id,
            area_node_id=area_node_id,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset,
            include_deleted=include_deleted,
            include_system_roots=include_system_roots,
            tree=tree,
            parent_id=parent_id,
            actor_roles=list(user.roles or []),
            tag_id=tag_id,
            team_id=team_id,
            assignee_id=assignee_id,
            unassigned_only=unassigned_only,
            stale_traceability_only=stale_traceability_only,
        )
    )
    items = [artifact_response_from_dto(d) for d in result.items]
    items = await mask_artifact_list_for_user(items, user)
    list_actions = (
        items[0].allowed_actions
        if items
        else allowed_actions_for_artifact(await get_user_privileges(user.tenant_id, user.id))
    )
    return ArtifactListResponse(items=items, total=result.total, allowed_actions=list_actions)


@router.post(
    "/projects/{project_id}/artifacts/batch-transition",
    response_model=BatchResultResponse,
)
async def batch_transition_artifacts(
    project_id: uuid.UUID,
    body: BatchTransitionRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:transition"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> BatchResultResponse:
    success_count = 0
    errors: list[str] = []
    results: dict[str, str] = {}
    for artifact_id in body.artifact_ids:
        aid = str(artifact_id)
        try:
            await mediator.send(
                TransitionArtifact(
                    tenant_id=org.tenant_id,
                    project_id=project_id,
                    artifact_id=artifact_id,
                    new_state=body.new_state,
                    trigger=body.trigger,
                    state_reason=body.state_reason,
                    resolution=body.resolution,
                    updated_by=user.id,
                    actor_roles=tuple(user.roles) if user.roles else None,
                )
            )
            success_count += 1
            results[aid] = "ok"
        except GuardDeniedError as e:
            results[aid] = "guard_denied"
            errors.append(f"{artifact_id}: {e!s}")
        except PolicyDeniedError as e:
            results[aid] = "policy_denied"
            errors.append(f"{artifact_id}: {e!s}")
        except ConflictError as e:
            results[aid] = "conflict_error"
            errors.append(f"{artifact_id}: {e!s}")
        except ValidationError as e:
            results[aid] = "validation_error"
            errors.append(f"{artifact_id}: {e!s}")
        except Exception as e:  # noqa: BLE001
            results[aid] = "validation_error"
            errors.append(f"{artifact_id}: {e!s}")
    return BatchResultResponse(
        success_count=success_count,
        error_count=len(errors),
        errors=errors[:20],
        results=results,
    )


@router.post(
    "/projects/{project_id}/artifacts/batch-delete",
    response_model=BatchResultResponse,
)
async def batch_delete_artifacts(
    project_id: uuid.UUID,
    body: BatchDeleteRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:delete"),
    mediator: Mediator = Depends(get_mediator),
) -> BatchResultResponse:
    success_count = 0
    errors: list[str] = []
    for artifact_id in body.artifact_ids:
        try:
            await mediator.send(
                DeleteArtifact(
                    tenant_id=org.tenant_id,
                    project_id=project_id,
                    artifact_id=artifact_id,
                    deleted_by=user.id,
                )
            )
            success_count += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"{artifact_id}: {e!s}")
    return BatchResultResponse(
        success_count=success_count,
        error_count=len(errors),
        errors=errors[:20],
    )


@router.post(
    "/projects/{project_id}/artifacts",
    response_model=ArtifactResponse,
    status_code=201,
)
async def create_artifact(
    project_id: uuid.UUID,
    body: ArtifactCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:create"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactResponse:
    dto = await mediator.send(
        CreateArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_type=body.artifact_type,
            title=body.title,
            description=body.description,
            parent_id=body.parent_id,
            assignee_id=body.assignee_id,
            custom_fields=body.custom_fields,
            artifact_key=body.artifact_key,
            rank_order=body.rank_order,
            cycle_id=body.cycle_id,
            area_node_id=body.area_node_id,
            team_id=body.team_id,
            created_by=user.id,
            tag_ids=body.tag_ids,
        )
    )
    resp = artifact_response_from_dto(dto)
    return await mask_artifact_for_user(resp, user)


@router.get("/projects/{project_id}/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactResponse:
    dto = await mediator.query(
        GetArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            actor_roles=list(user.roles or []),
        )
    )
    if dto is None:
        raise EntityNotFound("Artifact", artifact_id)
    resp = artifact_response_from_dto(dto)
    return await mask_artifact_for_user(resp, user)


@router.patch(
    "/projects/{project_id}/artifacts/{artifact_id}",
    response_model=ArtifactResponse,
)
async def update_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            updates=updates,
            updated_by=user.id,
        )
    )
    resp = artifact_response_from_dto(dto)
    return await mask_artifact_for_user(resp, user)


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/permitted-transitions",
    response_model=PermittedTransitionsResponse,
)
async def get_permitted_transitions(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> PermittedTransitionsResponse:
    rows = await mediator.query(
        GetPermittedTransitions(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
    )
    return PermittedTransitionsResponse(
        items=[PermittedTransitionItem(trigger=r.trigger, to_state=r.to_state, label=r.label) for r in rows],
    )


@router.patch(
    "/projects/{project_id}/artifacts/{artifact_id}/transition",
    response_model=ArtifactResponse,
)
async def transition_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ArtifactTransitionRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:transition"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactResponse:
    dto = await mediator.send(
        TransitionArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            new_state=body.new_state,
            trigger=body.trigger,
            state_reason=body.state_reason,
            resolution=body.resolution,
            updated_by=user.id,
            expected_updated_at=body.expected_updated_at,
            actor_roles=tuple(user.roles) if user.roles else None,
        )
    )
    resp = artifact_response_from_dto(dto)
    return await mask_artifact_for_user(resp, user)


@router.delete(
    "/projects/{project_id}/artifacts/{artifact_id}",
    status_code=204,
)
async def delete_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:delete"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            deleted_by=user.id,
        )
    )
    return None


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/restore",
    response_model=ArtifactResponse,
)
async def restore_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactResponse:
    dto = await mediator.send(
        RestoreArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            restored_by=user.id,
        )
    )
    resp = artifact_response_from_dto(dto)
    return await mask_artifact_for_user(resp, user)
