"""Azure DevOps-style org router: /orgs/{org_slug}/..."""

# mypy: disable-error-code="no-untyped-def"

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from alm.area.api.schemas import (
    AreaNodeCreateRequest,
    AreaNodeResponse,
    AreaNodeUpdateRequest,
    MoveAreaRequest,
    RenameAreaRequest,
)
from alm.area.application.commands.activate_area import ActivateAreaNode
from alm.area.application.commands.create_area import CreateAreaNode
from alm.area.application.commands.deactivate_area import DeactivateAreaNode
from alm.area.application.commands.delete_area import DeleteAreaNode
from alm.area.application.commands.move_area import MoveAreaNode
from alm.area.application.commands.rename_area import RenameAreaNode
from alm.area.application.commands.update_area import UpdateAreaNode
from alm.area.application.queries.get_area import GetAreaNode
from alm.area.application.queries.list_areas_by_project import ListAreaNodesByProject
from alm.artifact.api.schemas import (
    ArtifactCreateRequest,
    ArtifactListResponse,
    ArtifactResponse,
    ArtifactTransitionRequest,
    ArtifactUpdateRequest,
    BatchDeleteRequest,
    BatchResultResponse,
    BatchTransitionRequest,
    PermittedTransitionItem,
    PermittedTransitionsResponse,
)
from alm.artifact.application.commands.create_artifact import CreateArtifact
from alm.artifact.application.commands.delete_artifact import DeleteArtifact
from alm.artifact.application.commands.restore_artifact import RestoreArtifact
from alm.artifact.application.commands.transition_artifact import TransitionArtifact
from alm.artifact.application.commands.update_artifact import UpdateArtifact
from alm.artifact.application.queries.get_artifact import GetArtifact
from alm.artifact.application.queries.get_permitted_transitions import GetPermittedTransitions
from alm.artifact.application.queries.list_artifacts import ListArtifacts
from alm.artifact_link.api.schemas import ArtifactLinkCreateRequest, ArtifactLinkResponse
from alm.artifact_link.application.commands.create_artifact_link import CreateArtifactLink
from alm.artifact_link.application.commands.delete_artifact_link import DeleteArtifactLink
from alm.artifact_link.application.queries.list_artifact_links import ListArtifactLinks
from alm.attachment.api.schemas import AttachmentResponse
from alm.attachment.application.commands.create_attachment import CreateAttachment
from alm.attachment.application.commands.delete_attachment import DeleteAttachment
from alm.attachment.application.queries.get_attachment import GetAttachment
from alm.attachment.application.queries.list_attachments_by_artifact import ListAttachmentsByArtifact
from alm.attachment.domain.ports import FileStoragePort
from alm.comment.api.schemas import CommentCreateRequest, CommentResponse
from alm.comment.application.commands.create_comment import CreateComment
from alm.comment.application.queries.list_comments_by_artifact import ListCommentsByArtifact
from alm.config.dependencies import get_file_storage, get_manifest_flattener, get_mediator
from alm.cycle.api.schemas import (
    CycleNodeCreateRequest,
    CycleNodeResponse,
    CycleNodeUpdateRequest,
)
from alm.cycle.application.commands.create_cycle import CreateCycleNode
from alm.cycle.application.commands.delete_cycle import DeleteCycleNode
from alm.cycle.application.commands.update_cycle import UpdateCycleNode
from alm.cycle.application.queries.get_cycle import GetCycleNode
from alm.cycle.application.queries.list_cycles_by_project import ListCycleNodesByProject
from alm.form_schema.api.schemas import (
    FormFieldSchemaResponse,
    FormSchemaResponse,
    ListColumnSchemaResponse,
    ListFilterSchemaResponse,
    ListSchemaResponse,
)
from alm.form_schema.application.queries.get_form_schema import GetFormSchema
from alm.form_schema.application.queries.get_list_schema import GetListSchema
from alm.project.api.schemas import (
    AddProjectMemberRequest,
    ProjectCreateRequest,
    ProjectMemberResponse,
    ProjectResponse,
    UpdateProjectManifestRequest,
    UpdateProjectMemberRequest,
    UpdateProjectRequest,
)
from alm.project.application.commands.add_project_member import AddProjectMember
from alm.project.application.commands.create_project import CreateProject
from alm.project.application.commands.remove_project_member import RemoveProjectMember
from alm.project.application.commands.update_project import UpdateProject
from alm.project.application.commands.update_project_manifest import UpdateProjectManifest
from alm.project.application.commands.update_project_member import UpdateProjectMember
from alm.project.application.queries.get_burndown import GetBurndown
from alm.project.application.queries.get_org_dashboard_activity import (
    GetOrgDashboardActivity,
)
from alm.project.application.queries.get_org_dashboard_stats import (
    GetOrgDashboardStats,
)
from alm.project.application.queries.get_project import GetProject
from alm.project.application.queries.get_project_manifest import GetProjectManifest
from alm.project.application.queries.get_velocity import GetVelocity
from alm.project.application.queries.list_project_members import ListProjectMembers
from alm.project.application.queries.list_projects import ListProjects
from alm.saved_query.api.schemas import (
    SavedQueryCreateRequest,
    SavedQueryResponse,
    SavedQueryUpdateRequest,
)
from alm.saved_query.application.commands.create_saved_query import CreateSavedQuery
from alm.saved_query.application.commands.delete_saved_query import DeleteSavedQuery
from alm.saved_query.application.commands.update_saved_query import UpdateSavedQuery
from alm.saved_query.application.queries.get_saved_query import GetSavedQuery
from alm.saved_query.application.queries.list_saved_queries import ListSavedQueries
from alm.shared.api.schemas import MessageResponse
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import ConflictError, EntityNotFound, PolicyDeniedError, ValidationError
from alm.shared.infrastructure.org_resolver import ResolvedOrg, resolve_org
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    get_user_privileges,
    require_permission,
)
from alm.shared.infrastructure.security.field_masking import (
    allowed_actions_for_artifact,
    mask_artifact_for_user,
    mask_artifact_list_for_user,
)
from alm.shared.infrastructure.security.manifest_acl import require_manifest_acl
from alm.task.api.schemas import (
    TaskCreateRequest,
    TaskResponse,
    TaskUpdateRequest,
)
from alm.task.application.commands.create_task import CreateTask
from alm.task.application.commands.delete_task import DeleteTask
from alm.task.application.commands.update_task import UpdateTask
from alm.task.application.queries.get_task import GetTask
from alm.task.application.queries.list_tasks_by_artifact import ListTasksByArtifact
from alm.task.application.queries.list_tasks_by_project_and_assignee import (
    ListTasksByProjectAndAssignee,
)
from alm.team.api.schemas import (
    AddTeamMemberRequest,
    TeamCreateRequest,
    TeamMemberResponse,
    TeamResponse,
    TeamUpdateRequest,
)
from alm.team.application.commands.add_team_member import AddTeamMember
from alm.team.application.commands.create_team import CreateTeam
from alm.team.application.commands.delete_team import DeleteTeam
from alm.team.application.commands.remove_team_member import RemoveTeamMember
from alm.team.application.commands.update_team import UpdateTeam
from alm.team.application.queries.get_team import GetTeam
from alm.team.application.queries.list_teams_by_project import ListTeamsByProject
from alm.tenant.api.schemas import (
    AddRoleRequest,
    AssignRolesRequest,
    CreateRoleRequest,
    InvitationResponse,
    InviteMemberRequest,
    MemberResponse,
    PrivilegeSchema,
    RoleDetailResponse,
    RoleInfoSchema,
    SetRolePrivilegesRequest,
    TenantResponse,
    UpdateRoleRequest,
    UpdateTenantRequest,
)
from alm.tenant.application.commands.assign_roles import AssignRoles
from alm.tenant.application.commands.create_role import CreateRole
from alm.tenant.application.commands.delete_role import DeleteRole
from alm.tenant.application.commands.invite_member import InviteMember
from alm.tenant.application.commands.remove_member import RemoveMember
from alm.tenant.application.commands.revoke_role import RevokeRole
from alm.tenant.application.commands.set_role_privileges import SetRolePrivileges
from alm.tenant.application.commands.update_role import UpdateRole
from alm.tenant.application.commands.update_tenant import UpdateTenant
from alm.tenant.application.dtos import (
    InvitationDTO,
    RoleDetailDTO,
    TenantDTO,
)
from alm.tenant.application.queries.get_member_roles import GetMemberRoles
from alm.tenant.application.queries.get_role import GetRole
from alm.tenant.application.queries.list_members import ListTenantMembers
from alm.tenant.application.queries.list_roles import ListTenantRoles
from alm.workflow_rule.api.schemas import (
    WorkflowRuleCreateRequest,
    WorkflowRuleResponse,
    WorkflowRuleUpdateRequest,
)
from alm.workflow_rule.application.commands.create_workflow_rule import CreateWorkflowRule
from alm.workflow_rule.application.commands.delete_workflow_rule import DeleteWorkflowRule
from alm.workflow_rule.application.commands.update_workflow_rule import UpdateWorkflowRule
from alm.workflow_rule.application.queries.get_workflow_rule import GetWorkflowRule
from alm.workflow_rule.application.queries.list_workflow_rules import ListWorkflowRules

router = APIRouter(prefix="/orgs/{org_slug}", tags=["orgs"])


# ── Org (tenant) ──


@router.get("", response_model=TenantResponse)
async def get_org(
    org: ResolvedOrg = Depends(resolve_org),
) -> TenantResponse:
    return TenantResponse(id=org.dto.id, name=org.dto.name, slug=org.dto.slug, tier=org.dto.tier)


@router.put("", response_model=TenantResponse)
async def update_org(
    body: UpdateTenantRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("tenant:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TenantResponse:
    dto: TenantDTO = await mediator.send(UpdateTenant(tenant_id=org.tenant_id, name=body.name, settings=body.settings))
    return TenantResponse(id=dto.id, name=dto.name, slug=dto.slug, tier=dto.tier)


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
    return ProjectResponse(
        id=dto.id,
        code=dto.code,
        name=dto.name,
        slug=dto.slug,
        description=dto.description,
        status=dto.status,
        settings=dto.settings,
        metadata=dto.metadata_,
    )


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ProjectResponse]:
    dtos = await mediator.query(ListProjects(tenant_id=org.tenant_id))
    return [
        ProjectResponse(
            id=d.id,
            code=d.code,
            name=d.name,
            slug=d.slug,
            description=d.description,
            status=d.status,
            settings=d.settings,
            metadata=d.metadata_,
        )
        for d in dtos
    ]


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
    return ProjectResponse(
        id=dto.id,
        code=dto.code,
        name=dto.name,
        slug=dto.slug,
        description=dto.description,
        status=dto.status,
        settings=dto.settings,
        metadata=dto.metadata_,
    )


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
    return ProjectResponse(
        id=dto.id,
        code=dto.code,
        name=dto.name,
        slug=dto.slug,
        description=dto.description,
        status=dto.status,
        settings=dto.settings,
        metadata=dto.metadata_,
    )


@router.get("/projects/{project_id}/members", response_model=list[ProjectMemberResponse])
async def list_project_members(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user=require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ProjectMemberResponse]:
    members = await mediator.query(ListProjectMembers(tenant_id=org.tenant_id, project_id=project_id))
    return [
        ProjectMemberResponse(id=m.id, project_id=m.project_id, user_id=m.user_id, role=m.role)
        for m in members
    ]


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
    cycle_node_id: uuid.UUID | None = None,
    area_node_id: uuid.UUID | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
    limit: int = 20,
    offset: int = 0,
    include_deleted: bool = False,
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
            cycle_node_id=cycle_node_id,
            area_node_id=area_node_id,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset,
            include_deleted=include_deleted,
        )
    )
    items = [
        ArtifactResponse(
            id=d.id,
            project_id=d.project_id,
            artifact_type=d.artifact_type,
            title=d.title,
            description=d.description,
            state=d.state,
            assignee_id=d.assignee_id,
            parent_id=d.parent_id,
            custom_fields=d.custom_fields,
            artifact_key=d.artifact_key,
            state_reason=d.state_reason,
            resolution=d.resolution,
            rank_order=d.rank_order,
            cycle_node_id=getattr(d, "cycle_node_id", None),
            area_node_id=getattr(d, "area_node_id", None),
            area_path_snapshot=getattr(d, "area_path_snapshot", None),
            created_at=getattr(d, "created_at", None),
            updated_at=getattr(d, "updated_at", None),
        )
        for d in result.items
    ]
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
        aid_str = str(artifact_id)
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
            results[aid_str] = "ok"
        except PolicyDeniedError as e:
            errors.append(f"{artifact_id}: {e!s}")
            results[aid_str] = "policy_denied"
        except ValidationError as e:
            errors.append(f"{artifact_id}: {e!s}")
            results[aid_str] = "validation_error"
        except ConflictError as e:
            errors.append(f"{artifact_id}: {e!s}")
            results[aid_str] = "conflict_error"
        except Exception as e:  # noqa: BLE001
            errors.append(f"{artifact_id}: {e!s}")
            results[aid_str] = "validation_error"
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
            cycle_node_id=body.cycle_node_id,
            area_node_id=body.area_node_id,
            created_by=user.id,
        )
    )
    resp = ArtifactResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_type=dto.artifact_type,
        title=dto.title,
        description=dto.description,
        state=dto.state,
        assignee_id=dto.assignee_id,
        parent_id=dto.parent_id,
        custom_fields=dto.custom_fields,
        artifact_key=dto.artifact_key,
        state_reason=dto.state_reason,
        resolution=dto.resolution,
        rank_order=dto.rank_order,
        cycle_node_id=getattr(dto, "cycle_node_id", None),
        area_node_id=getattr(dto, "area_node_id", None),
        area_path_snapshot=getattr(dto, "area_path_snapshot", None),
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )
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
        )
    )
    if dto is None:
        raise EntityNotFound("Artifact", artifact_id)
    resp = ArtifactResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_type=dto.artifact_type,
        title=dto.title,
        description=dto.description,
        state=dto.state,
        assignee_id=dto.assignee_id,
        parent_id=dto.parent_id,
        custom_fields=dto.custom_fields,
        artifact_key=dto.artifact_key,
        state_reason=dto.state_reason,
        resolution=dto.resolution,
        rank_order=dto.rank_order,
        cycle_node_id=getattr(dto, "cycle_node_id", None),
        area_node_id=getattr(dto, "area_node_id", None),
        area_path_snapshot=getattr(dto, "area_path_snapshot", None),
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )
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
    resp = ArtifactResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_type=dto.artifact_type,
        title=dto.title,
        description=dto.description,
        state=dto.state,
        assignee_id=dto.assignee_id,
        parent_id=dto.parent_id,
        custom_fields=dto.custom_fields,
        artifact_key=dto.artifact_key,
        state_reason=dto.state_reason,
        resolution=dto.resolution,
        rank_order=dto.rank_order,
        cycle_node_id=getattr(dto, "cycle_node_id", None),
        area_node_id=getattr(dto, "area_node_id", None),
        area_path_snapshot=getattr(dto, "area_path_snapshot", None),
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )
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
    items = await mediator.query(
        GetPermittedTransitions(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
    )
    return PermittedTransitionsResponse(
        items=[PermittedTransitionItem(trigger=d.trigger, to_state=d.to_state, label=d.label) for d in items],
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
    resp = ArtifactResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_type=dto.artifact_type,
        title=dto.title,
        description=dto.description,
        state=dto.state,
        assignee_id=dto.assignee_id,
        parent_id=dto.parent_id,
        custom_fields=dto.custom_fields,
        artifact_key=dto.artifact_key,
        state_reason=dto.state_reason,
        resolution=dto.resolution,
        rank_order=dto.rank_order,
        cycle_node_id=getattr(dto, "cycle_node_id", None),
        area_node_id=getattr(dto, "area_node_id", None),
        area_path_snapshot=getattr(dto, "area_path_snapshot", None),
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )
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
    resp = ArtifactResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_type=dto.artifact_type,
        title=dto.title,
        description=dto.description,
        state=dto.state,
        assignee_id=dto.assignee_id,
        parent_id=dto.parent_id,
        custom_fields=dto.custom_fields,
        artifact_key=dto.artifact_key,
        state_reason=dto.state_reason,
        resolution=dto.resolution,
        rank_order=dto.rank_order,
        cycle_node_id=getattr(dto, "cycle_node_id", None),
        area_node_id=getattr(dto, "area_node_id", None),
        area_path_snapshot=getattr(dto, "area_path_snapshot", None),
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )
    return await mask_artifact_for_user(resp, user)


# ── Tasks (artifact-linked) ──


@router.get(
    "/projects/{project_id}/tasks",
    response_model=list[TaskResponse],
)
async def list_tasks_by_project_and_assignee(
    project_id: uuid.UUID,
    assignee_id: str = Query(..., description="Use 'me' for current user's tasks"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("task:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[TaskResponse]:
    """List tasks in a project. Use assignee_id=me to get tasks assigned to the current user."""
    if assignee_id.lower() != "me":
        raise HTTPException(400, "Only assignee_id=me is supported")
    assignee_uuid = user.id
    dtos = await mediator.query(
        ListTasksByProjectAndAssignee(
            tenant_id=org.tenant_id,
            project_id=project_id,
            assignee_id=assignee_uuid,
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


# ── Comments (artifact-linked) ──


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
    flattener=Depends(get_manifest_flattener),
) -> ArtifactLinkResponse:
    # When manifest defines link_types, validate body.link_type against them
    manifest_result = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    if manifest_result and manifest_result.manifest_bundle:
        flat = flattener.flatten(manifest_result.manifest_bundle)
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


# ── Saved queries ──


def _saved_query_dto_to_response(dto) -> SavedQueryResponse:
    return SavedQueryResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        owner_id=dto.owner_id,
        visibility=dto.visibility,
        filter_params=dto.filter_params,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


def _parse_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


@router.get(
    "/projects/{project_id}/saved-queries",
    response_model=list[SavedQueryResponse],
)
async def list_saved_queries(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[SavedQueryResponse]:
    dtos = await mediator.query(
        ListSavedQueries(
            tenant_id=org.tenant_id,
            project_id=project_id,
            user_id=user.id,
        )
    )
    return [_saved_query_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/saved-queries",
    response_model=SavedQueryResponse,
    status_code=201,
)
async def create_saved_query(
    project_id: uuid.UUID,
    body: SavedQueryCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> SavedQueryResponse:
    dto = await mediator.send(
        CreateSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            owner_id=user.id,
            filter_params=body.filter_params,
            visibility=body.visibility,
        )
    )
    return _saved_query_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/saved-queries/{query_id}",
    response_model=SavedQueryResponse,
)
async def get_saved_query(
    project_id: uuid.UUID,
    query_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> SavedQueryResponse:
    dto = await mediator.query(
        GetSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            query_id=query_id,
        )
    )
    if dto is None:
        raise EntityNotFound("SavedQuery", query_id)
    return _saved_query_dto_to_response(dto)


@router.put(
    "/projects/{project_id}/saved-queries/{query_id}",
    response_model=SavedQueryResponse,
)
async def update_saved_query(
    project_id: uuid.UUID,
    query_id: uuid.UUID,
    body: SavedQueryUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> SavedQueryResponse:
    dto = await mediator.send(
        UpdateSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            query_id=query_id,
            name=body.name,
            filter_params=body.filter_params,
            visibility=body.visibility,
        )
    )
    return _saved_query_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/saved-queries/{query_id}",
    status_code=204,
)
async def delete_saved_query(
    project_id: uuid.UUID,
    query_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            query_id=query_id,
        )
    )


@router.get(
    "/projects/{project_id}/saved-queries/{query_id}/run",
    response_model=ArtifactListResponse,
)
async def run_saved_query(
    project_id: uuid.UUID,
    query_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactListResponse:
    dto = await mediator.query(
        GetSavedQuery(
            tenant_id=org.tenant_id,
            project_id=project_id,
            query_id=query_id,
        )
    )
    if dto is None:
        raise EntityNotFound("SavedQuery", query_id)
    if dto.visibility == "private" and dto.owner_id != user.id:
        raise EntityNotFound("SavedQuery", query_id)
    fp = dto.filter_params or {}
    result = await mediator.query(
        ListArtifacts(
            tenant_id=org.tenant_id,
            project_id=project_id,
            state_filter=fp.get("state"),
            type_filter=fp.get("type"),
            search_query=fp.get("q"),
            cycle_node_id=_parse_uuid(fp.get("cycle_node_id")),
            area_node_id=_parse_uuid(fp.get("area_node_id")),
            sort_by=fp.get("sort_by"),
            sort_order=fp.get("sort_order"),
            limit=fp.get("limit", limit),
            offset=fp.get("offset", offset),
            include_deleted=False,
        )
    )
    items = [
        ArtifactResponse(
            id=d.id,
            project_id=d.project_id,
            artifact_type=d.artifact_type,
            title=d.title,
            description=d.description,
            state=d.state,
            assignee_id=d.assignee_id,
            parent_id=d.parent_id,
            custom_fields=d.custom_fields,
            artifact_key=d.artifact_key,
            state_reason=d.state_reason,
            resolution=d.resolution,
            rank_order=d.rank_order,
            cycle_node_id=getattr(d, "cycle_node_id", None),
            area_node_id=getattr(d, "area_node_id", None),
            area_path_snapshot=getattr(d, "area_path_snapshot", None),
            created_at=getattr(d, "created_at", None),
            updated_at=getattr(d, "updated_at", None),
        )
        for d in result.items
    ]
    return ArtifactListResponse(items=items, total=result.total)


# ── Workflow rules (automation) ──


def _workflow_rule_dto_to_response(dto) -> WorkflowRuleResponse:
    return WorkflowRuleResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        trigger_event_type=dto.trigger_event_type,
        condition_expression=dto.condition_expression,
        actions=dto.actions,
        is_active=dto.is_active,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


@router.get(
    "/projects/{project_id}/workflow-rules",
    response_model=list[WorkflowRuleResponse],
)
async def list_workflow_rules(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[WorkflowRuleResponse]:
    dtos = await mediator.query(ListWorkflowRules(tenant_id=org.tenant_id, project_id=project_id))
    return [_workflow_rule_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/workflow-rules",
    response_model=WorkflowRuleResponse,
    status_code=201,
)
async def create_workflow_rule(
    project_id: uuid.UUID,
    body: WorkflowRuleCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> WorkflowRuleResponse:
    dto = await mediator.send(
        CreateWorkflowRule(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            trigger_event_type=body.trigger_event_type,
            actions=body.actions,
            condition_expression=body.condition_expression,
            is_active=body.is_active,
        )
    )
    return _workflow_rule_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/workflow-rules/{rule_id}",
    response_model=WorkflowRuleResponse,
)
async def get_workflow_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> WorkflowRuleResponse:
    dto = await mediator.query(
        GetWorkflowRule(
            tenant_id=org.tenant_id,
            project_id=project_id,
            rule_id=rule_id,
        )
    )
    if dto is None:
        raise EntityNotFound("WorkflowRule", rule_id)
    return _workflow_rule_dto_to_response(dto)


@router.put(
    "/projects/{project_id}/workflow-rules/{rule_id}",
    response_model=WorkflowRuleResponse,
)
async def update_workflow_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    body: WorkflowRuleUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> WorkflowRuleResponse:
    dto = await mediator.send(
        UpdateWorkflowRule(
            tenant_id=org.tenant_id,
            project_id=project_id,
            rule_id=rule_id,
            name=body.name,
            trigger_event_type=body.trigger_event_type,
            condition_expression=body.condition_expression,
            actions=body.actions,
            is_active=body.is_active,
        )
    )
    return _workflow_rule_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/workflow-rules/{rule_id}",
    status_code=204,
)
async def delete_workflow_rule(
    project_id: uuid.UUID,
    rule_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteWorkflowRule(
            tenant_id=org.tenant_id,
            project_id=project_id,
            rule_id=rule_id,
        )
    )


# ── Cycle nodes (planning tree, pamera IterationNode-like) ──


def _cycle_node_dto_to_response(dto) -> CycleNodeResponse:
    children = [_cycle_node_dto_to_response(c) for c in getattr(dto, "children", []) or []]
    return CycleNodeResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        path=dto.path,
        parent_id=dto.parent_id,
        depth=dto.depth,
        sort_order=dto.sort_order,
        goal=dto.goal,
        start_date=dto.start_date,
        end_date=dto.end_date,
        state=dto.state,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        children=children,
    )


@router.get(
    "/projects/{project_id}/cycle-nodes",
    response_model=list[CycleNodeResponse],
)
async def list_cycle_nodes(
    project_id: uuid.UUID,
    flat: bool = True,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[CycleNodeResponse]:
    dtos = await mediator.query(
        ListCycleNodesByProject(
            tenant_id=org.tenant_id,
            project_id=project_id,
            flat=flat,
        )
    )
    return [_cycle_node_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/cycle-nodes",
    response_model=CycleNodeResponse,
    status_code=201,
)
async def create_cycle_node(
    project_id: uuid.UUID,
    body: CycleNodeCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> CycleNodeResponse:
    dto = await mediator.send(
        CreateCycleNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            parent_id=body.parent_id,
            sort_order=body.sort_order,
            goal=body.goal,
            start_date=body.start_date,
            end_date=body.end_date,
            state=body.state,
        )
    )
    return _cycle_node_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/cycle-nodes/{cycle_node_id}",
    response_model=CycleNodeResponse,
)
async def get_cycle_node(
    project_id: uuid.UUID,
    cycle_node_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> CycleNodeResponse:
    dto = await mediator.query(
        GetCycleNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_node_id=cycle_node_id,
        )
    )
    if dto is None:
        raise EntityNotFound("CycleNode", cycle_node_id)
    return _cycle_node_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/cycle-nodes/{cycle_node_id}",
    response_model=CycleNodeResponse,
)
async def update_cycle_node(
    project_id: uuid.UUID,
    cycle_node_id: uuid.UUID,
    body: CycleNodeUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> CycleNodeResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateCycleNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_node_id=cycle_node_id,
            name=updates.get("name"),
            goal=updates.get("goal"),
            start_date=updates.get("start_date"),
            end_date=updates.get("end_date"),
            state=updates.get("state"),
            sort_order=updates.get("sort_order"),
        )
    )
    return _cycle_node_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/cycle-nodes/{cycle_node_id}",
    status_code=204,
)
async def delete_cycle_node(
    project_id: uuid.UUID,
    cycle_node_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteCycleNode(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_node_id=cycle_node_id,
        )
    )


# ── Teams (P6) ──


def _team_dto_to_response(dto) -> TeamResponse:
    return TeamResponse(
        id=dto.id,
        project_id=dto.project_id,
        name=dto.name,
        description=dto.description,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        members=[TeamMemberResponse(team_id=m.team_id, user_id=m.user_id, role=m.role) for m in (dto.members or [])],
    )


@router.get(
    "/projects/{project_id}/teams",
    response_model=list[TeamResponse],
)
async def list_teams(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[TeamResponse]:
    dtos = await mediator.query(ListTeamsByProject(tenant_id=org.tenant_id, project_id=project_id))
    return [_team_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/teams",
    response_model=TeamResponse,
    status_code=201,
)
async def create_team(
    project_id: uuid.UUID,
    body: TeamCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    dto = await mediator.send(
        CreateTeam(
            tenant_id=org.tenant_id,
            project_id=project_id,
            name=body.name,
            description=body.description,
        )
    )
    return _team_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/teams/{team_id}",
    response_model=TeamResponse,
)
async def get_team(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    dto = await mediator.query(GetTeam(tenant_id=org.tenant_id, project_id=project_id, team_id=team_id))
    if dto is None:
        raise EntityNotFound("Team", team_id)
    return _team_dto_to_response(dto)


@router.patch(
    "/projects/{project_id}/teams/{team_id}",
    response_model=TeamResponse,
)
async def update_team(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    body: TeamUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    updates = body.model_dump(exclude_unset=True)
    dto = await mediator.send(
        UpdateTeam(
            tenant_id=org.tenant_id,
            project_id=project_id,
            team_id=team_id,
            name=updates.get("name"),
            description=updates.get("description"),
        )
    )
    return _team_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/teams/{team_id}",
    status_code=204,
)
async def delete_team(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(DeleteTeam(tenant_id=org.tenant_id, project_id=project_id, team_id=team_id))


@router.post(
    "/projects/{project_id}/teams/{team_id}/members",
    response_model=TeamResponse,
)
async def add_team_member(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    body: AddTeamMemberRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    dto = await mediator.send(
        AddTeamMember(
            tenant_id=org.tenant_id,
            project_id=project_id,
            team_id=team_id,
            user_id=body.user_id,
            role=body.role,
        )
    )
    return _team_dto_to_response(dto)


@router.delete(
    "/projects/{project_id}/teams/{team_id}/members/{user_id}",
    response_model=TeamResponse,
)
async def remove_team_member(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TeamResponse:
    dto = await mediator.send(
        RemoveTeamMember(
            tenant_id=org.tenant_id,
            project_id=project_id,
            team_id=team_id,
            user_id=user_id,
        )
    )
    return _team_dto_to_response(dto)


# ── Velocity (P4) ──


class VelocityPointResponse(BaseModel):
    cycle_node_id: uuid.UUID
    cycle_name: str
    total_effort: float


@router.get(
    "/projects/{project_id}/velocity",
    response_model=list[VelocityPointResponse],
)
async def get_velocity(
    project_id: uuid.UUID,
    cycle_node_id: list[uuid.UUID] | None = Query(None, alias="cycle_node_id"),
    last_n: int | None = Query(None, description="Last N cycles by order (if cycle_node_id not set)"),
    effort_field: str = Query("story_points", description="Custom field key for effort"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[VelocityPointResponse]:
    dtos = await mediator.query(
        GetVelocity(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_node_ids=cycle_node_id,
            last_n=last_n,
            effort_field=effort_field,
        )
    )
    return [
        VelocityPointResponse(
            cycle_node_id=d.cycle_node_id,
            cycle_name=d.cycle_name,
            total_effort=d.total_effort,
        )
        for d in dtos
    ]


class BurndownPointResponse(BaseModel):
    cycle_node_id: uuid.UUID
    cycle_name: str
    total_effort: float
    completed_effort: float
    remaining_effort: float


@router.get(
    "/projects/{project_id}/burndown",
    response_model=list[BurndownPointResponse],
)
async def get_burndown(
    project_id: uuid.UUID,
    cycle_node_id: list[uuid.UUID] | None = Query(None, alias="cycle_node_id"),
    last_n: int | None = Query(None, description="Last N cycles by order (if cycle_node_id not set)"),
    effort_field: str = Query("story_points", description="Custom field key for effort"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[BurndownPointResponse]:
    dtos = await mediator.query(
        GetBurndown(
            tenant_id=org.tenant_id,
            project_id=project_id,
            cycle_node_ids=cycle_node_id,
            last_n=last_n,
            effort_field=effort_field,
        )
    )
    return [
        BurndownPointResponse(
            cycle_node_id=d.cycle_node_id,
            cycle_name=d.cycle_name,
            total_effort=d.total_effort,
            completed_effort=d.completed_effort,
            remaining_effort=d.remaining_effort,
        )
        for d in dtos
    ]


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
    user: CurrentUser = require_permission("manifest:read"),
    _acl: None = require_manifest_acl("manifest", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> ListSchemaResponse:
    """Get list schema (columns + filters) for entity type from project manifest."""
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
    flattener=Depends(get_manifest_flattener),
) -> dict[str, Any]:
    """Get manifest bundle for the project's process template version."""
    manifest = await mediator.query(GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id))
    if manifest is None:
        raise EntityNotFound("ProjectManifest", project_id)

    bundle = dict(manifest.manifest_bundle or {})
    flat = flattener.flatten(bundle)
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
    flattener=Depends(get_manifest_flattener),
) -> dict[str, Any]:
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
    flat = flattener.flatten(bundle)
    bundle["workflows"] = flat["workflows"]
    bundle["artifact_types"] = flat["artifact_types"]
    bundle["link_types"] = flat["link_types"]
    return {
        "manifest_bundle": bundle,
        "template_name": manifest.template_name,
        "template_slug": manifest.template_slug,
        "version": manifest.version,
    }


# ── Dashboard ──


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict[str, Any]:
    stats = await mediator.query(GetOrgDashboardStats(tenant_id=org.tenant_id))
    return {
        "projects": stats.projects,
        "artifacts": stats.artifacts,
        "tasks": stats.tasks,
        "openDefects": stats.open_defects,
    }


@router.get("/dashboard/activity")
async def get_dashboard_activity(
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
    limit: int = 10,
) -> list[dict[str, Any]]:
    items = await mediator.query(GetOrgDashboardActivity(tenant_id=org.tenant_id, limit=min(limit, 50)))
    return [
        {
            "artifact_id": str(i.artifact_id),
            "project_id": str(i.project_id),
            "project_slug": i.project_slug,
            "title": i.title,
            "state": i.state,
            "artifact_type": i.artifact_type,
            "updated_at": i.updated_at.isoformat() if i.updated_at else None,
        }
        for i in items
    ]


# ── Members ──


@router.get("/members", response_model=list[MemberResponse])
async def list_members(
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("member:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[MemberResponse]:
    items = await mediator.query(ListTenantMembers(tenant_id=org.tenant_id))
    return [
        MemberResponse(
            user_id=d.user_id,
            email=d.email,
            display_name=d.display_name,
            roles=[
                RoleInfoSchema(
                    id=r.id,
                    name=r.name,
                    slug=r.slug,
                    is_system=r.is_system,
                    hierarchy_level=r.hierarchy_level,
                )
                for r in d.roles
            ],
            joined_at=d.joined_at,
        )
        for d in items
    ]


@router.post("/invite", response_model=InvitationResponse, status_code=201)
async def invite_member(
    body: InviteMemberRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("member:invite"),
    mediator: Mediator = Depends(get_mediator),
) -> InvitationResponse:
    dto: InvitationDTO = await mediator.send(
        InviteMember(
            tenant_id=org.tenant_id,
            email=body.email,
            role_ids=body.role_ids,
            invited_by=user.id,
        )
    )
    return InvitationResponse(
        id=dto.id,
        email=dto.email,
        roles=[
            RoleInfoSchema(
                id=r.id,
                name=r.name,
                slug=r.slug,
                is_system=r.is_system,
                hierarchy_level=r.hierarchy_level,
            )
            for r in dto.roles
        ],
        expires_at=dto.expires_at,
        accepted_at=dto.accepted_at,
    )


@router.delete("/members/{user_id}", response_model=MessageResponse)
async def remove_member(
    user_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("member:remove"),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(RemoveMember(tenant_id=org.tenant_id, user_id=user_id, removed_by=user.id))
    return MessageResponse(message="Member removed")


@router.get("/members/{user_id}/roles", response_model=list[RoleInfoSchema])
async def get_member_roles(
    user_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("member:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[RoleInfoSchema]:
    dtos = await mediator.query(GetMemberRoles(tenant_id=org.tenant_id, user_id=user_id))
    return [
        RoleInfoSchema(
            id=d.id,
            name=d.name,
            slug=d.slug,
            is_system=d.is_system,
            hierarchy_level=d.hierarchy_level,
        )
        for d in dtos
    ]


@router.put("/members/{user_id}/roles", response_model=MessageResponse)
async def assign_roles(
    user_id: uuid.UUID,
    body: AssignRolesRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("member:change_role"),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(
        AssignRoles(
            tenant_id=org.tenant_id,
            user_id=user_id,
            role_ids=body.role_ids,
            assigned_by=user.id,
        )
    )
    return MessageResponse(message="Roles assigned")


@router.post("/members/{user_id}/roles", response_model=MessageResponse, status_code=201)
async def add_role_to_member(
    user_id: uuid.UUID,
    body: AddRoleRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("member:change_role"),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    from alm.tenant.application.commands.add_role_to_member import AddRoleToMember

    await mediator.send(
        AddRoleToMember(
            tenant_id=org.tenant_id,
            user_id=user_id,
            role_id=body.role_id,
            assigned_by=user.id,
        )
    )
    return MessageResponse(message="Role added")


@router.delete("/members/{user_id}/roles/{role_id}", response_model=MessageResponse)
async def revoke_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("member:change_role"),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(
        RevokeRole(
            tenant_id=org.tenant_id,
            user_id=user_id,
            role_id=role_id,
            revoked_by=user.id,
        )
    )
    return MessageResponse(message="Role revoked")


# ── Roles ──


def _role_detail_to_response(dto: RoleDetailDTO) -> RoleDetailResponse:
    return RoleDetailResponse(
        id=dto.id,
        name=dto.name,
        slug=dto.slug,
        description=dto.description,
        is_system=dto.is_system,
        hierarchy_level=dto.hierarchy_level,
        privileges=[
            PrivilegeSchema(
                id=p.id,
                code=p.code,
                resource=p.resource,
                action=p.action,
                description=p.description,
            )
            for p in dto.privileges
        ],
    )


@router.get("/roles", response_model=list[RoleDetailResponse])
async def list_roles(
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("role:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[RoleDetailResponse]:
    items = await mediator.query(ListTenantRoles(tenant_id=org.tenant_id))
    return [_role_detail_to_response(d) for d in items]


@router.post("/roles", response_model=RoleDetailResponse, status_code=201)
async def create_role(
    body: CreateRoleRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("role:create"),
    mediator: Mediator = Depends(get_mediator),
) -> RoleDetailResponse:
    dto = await mediator.send(
        CreateRole(
            tenant_id=org.tenant_id,
            name=body.name,
            slug=body.slug,
            description=body.description,
            hierarchy_level=body.hierarchy_level,
            privilege_ids=body.privilege_ids,
            created_by=user.id,
        )
    )
    return _role_detail_to_response(dto)


@router.get("/roles/{role_id}", response_model=RoleDetailResponse)
async def get_role(
    role_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("role:read"),
    mediator: Mediator = Depends(get_mediator),
) -> RoleDetailResponse:
    dto = await mediator.query(GetRole(role_id=role_id))
    return _role_detail_to_response(dto)


@router.put("/roles/{role_id}", response_model=RoleDetailResponse)
async def update_role(
    role_id: uuid.UUID,
    body: UpdateRoleRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("role:update"),
    mediator: Mediator = Depends(get_mediator),
) -> RoleDetailResponse:
    dto = await mediator.send(
        UpdateRole(
            role_id=role_id,
            name=body.name,
            description=body.description,
            hierarchy_level=body.hierarchy_level,
            updated_by=user.id,
        )
    )
    return _role_detail_to_response(dto)


@router.delete("/roles/{role_id}", response_model=MessageResponse)
async def delete_role(
    role_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("role:delete"),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(DeleteRole(role_id=role_id, deleted_by=user.id))
    return MessageResponse(message="Role deleted")


@router.put("/roles/{role_id}/privileges", response_model=RoleDetailResponse)
async def set_role_privileges(
    role_id: uuid.UUID,
    body: SetRolePrivilegesRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("role:update"),
    mediator: Mediator = Depends(get_mediator),
) -> RoleDetailResponse:
    dto = await mediator.send(
        SetRolePrivileges(
            role_id=role_id,
            privilege_ids=body.privilege_ids,
            updated_by=user.id,
        )
    )
    return _role_detail_to_response(dto)
