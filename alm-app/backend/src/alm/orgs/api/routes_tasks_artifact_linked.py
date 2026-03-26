"""Org API routes: Tasks (artifact-linked)."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Tasks (artifact-linked) ──


@router.get(
    "/projects/{project_id}/tasks",
    response_model=list[TaskResponse],
)
async def list_tasks_by_project_and_assignee(
    project_id: uuid.UUID,
    assignee_id: str,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("task:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[TaskResponse]:
    """List tasks in the project for an assignee. Use assignee_id=me for current user."""
    effective_assignee = user.id if assignee_id.strip().lower() == "me" else uuid.UUID(assignee_id)
    dtos = await mediator.query(
        ListTasksByProjectAndAssignee(
            tenant_id=org.tenant_id,
            project_id=project_id,
            assignee_id=effective_assignee,
        )
    )
    return [
        TaskResponse(
            id=d.id,
            project_id=d.project_id,
            artifact_id=d.artifact_id,
            title=d.title,
            state=d.state,
            description=d.description,
            assignee_id=d.assignee_id,
            rank_order=d.rank_order,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in dtos
    ]


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/tasks",
    response_model=list[TaskResponse],
)
async def list_tasks_by_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("task:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[TaskResponse]:
    dtos = await mediator.query(
        ListTasksByArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
    )
    return [
        TaskResponse(
            id=d.id,
            project_id=d.project_id,
            artifact_id=d.artifact_id,
            title=d.title,
            state=d.state,
            description=d.description,
            assignee_id=d.assignee_id,
            rank_order=d.rank_order,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in dtos
    ]


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/tasks",
    response_model=TaskResponse,
    status_code=201,
)
async def create_task(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: TaskCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("task:create"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> TaskResponse:
    dto = await mediator.send(
        CreateTask(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            title=body.title,
            description=body.description,
            state=body.state,
            assignee_id=body.assignee_id,
            rank_order=body.rank_order,
        )
    )
    return TaskResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_id=dto.artifact_id,
        title=dto.title,
        state=dto.state,
        description=dto.description,
        assignee_id=dto.assignee_id,
        rank_order=dto.rank_order,
        cycle_node_id=getattr(dto, "cycle_node_id", None),
        area_node_id=getattr(dto, "area_node_id", None),
        area_path_snapshot=getattr(dto, "area_path_snapshot", None),
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/tasks/{task_id}",
    response_model=TaskResponse,
)
async def get_task(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    task_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("task:read"),
    mediator: Mediator = Depends(get_mediator),
) -> TaskResponse:
    dto = await mediator.query(
        GetTask(
            tenant_id=org.tenant_id,
            project_id=project_id,
            task_id=task_id,
        )
    )
    if dto is None:
        raise EntityNotFound("Task", task_id)
    return TaskResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_id=dto.artifact_id,
        title=dto.title,
        state=dto.state,
        description=dto.description,
        assignee_id=dto.assignee_id,
        rank_order=dto.rank_order,
        cycle_node_id=getattr(dto, "cycle_node_id", None),
        area_node_id=getattr(dto, "area_node_id", None),
        area_path_snapshot=getattr(dto, "area_path_snapshot", None),
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


@router.patch(
    "/projects/{project_id}/artifacts/{artifact_id}/tasks/{task_id}",
    response_model=TaskResponse,
)
async def update_task(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    task_id: uuid.UUID,
    body: TaskUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("task:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> TaskResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateTask(
            tenant_id=org.tenant_id,
            project_id=project_id,
            task_id=task_id,
            title=updates.get("title"),
            state=updates.get("state"),
            description=updates.get("description"),
            assignee_id=updates.get("assignee_id"),
            rank_order=updates.get("rank_order"),
        )
    )
    return TaskResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_id=dto.artifact_id,
        title=dto.title,
        state=dto.state,
        description=dto.description,
        assignee_id=dto.assignee_id,
        rank_order=dto.rank_order,
        cycle_node_id=getattr(dto, "cycle_node_id", None),
        area_node_id=getattr(dto, "area_node_id", None),
        area_path_snapshot=getattr(dto, "area_path_snapshot", None),
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


@router.delete(
    "/projects/{project_id}/artifacts/{artifact_id}/tasks/{task_id}",
    status_code=204,
)
async def delete_task(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    task_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("task:delete"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteTask(
            tenant_id=org.tenant_id,
            project_id=project_id,
            task_id=task_id,
            deleted_by=user.id,
        )
    )
