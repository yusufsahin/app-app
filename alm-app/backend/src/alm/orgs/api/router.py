"""Azure DevOps-style org router: /orgs/{org_slug}/..."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from alm.shared.api.schemas import MessageResponse
from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import EntityNotFound
from alm.shared.infrastructure.org_resolver import ResolvedOrg, resolve_org
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    require_permission,
)
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
    MemberDTO,
    PrivilegeDTO,
    RoleDetailDTO,
    TenantDTO,
)
from alm.tenant.application.queries.get_member_roles import GetMemberRoles
from alm.tenant.application.queries.get_role import GetRole
from alm.tenant.application.queries.list_members import ListTenantMembers
from alm.tenant.application.queries.list_roles import ListTenantRoles
from alm.project.api.schemas import ProjectCreateRequest, ProjectResponse
from alm.project.application.commands.create_project import CreateProject
from alm.project.application.queries.get_project import GetProject
from alm.project.application.queries.get_project_manifest import GetProjectManifest
from alm.project.application.queries.list_projects import ListProjects
from alm.artifact.api.schemas import (
    ArtifactCreateRequest,
    ArtifactResponse,
    ArtifactTransitionRequest,
)
from alm.artifact.application.commands.create_artifact import CreateArtifact
from alm.artifact.application.commands.transition_artifact import TransitionArtifact
from alm.artifact.application.queries.get_artifact import GetArtifact
from alm.artifact.application.queries.list_artifacts import ListArtifacts

router = APIRouter(prefix="/orgs/{org_slug}", tags=["orgs"])


# ── Org (tenant) ──


@router.get("", response_model=TenantResponse)
async def get_org(
    org: ResolvedOrg = Depends(resolve_org),
) -> TenantResponse:
    return TenantResponse(
        id=org.dto.id, name=org.dto.name, slug=org.dto.slug, tier=org.dto.tier
    )


@router.put("", response_model=TenantResponse)
async def update_org(
    body: UpdateTenantRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("tenant:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TenantResponse:
    dto: TenantDTO = await mediator.send(
        UpdateTenant(tenant_id=org.tenant_id, name=body.name, settings=body.settings)
    )
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
            created_by=user.id,
        )
    )
    return ProjectResponse(
        id=dto.id,
        code=dto.code,
        name=dto.name,
        slug=dto.slug,
        description=dto.description,
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
            id=d.id, code=d.code, name=d.name, slug=d.slug, description=d.description
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
    dto = await mediator.query(
        GetProject(tenant_id=org.tenant_id, project_id=project_id)
    )
    if dto is None:
        raise EntityNotFound("Project", project_id)
    return ProjectResponse(
        id=dto.id, code=dto.code, name=dto.name, slug=dto.slug, description=dto.description
    )


@router.get("/projects/{project_id}/artifacts", response_model=list[ArtifactResponse])
async def list_artifacts(
    project_id: uuid.UUID,
    state: str | None = None,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ArtifactResponse]:
    dtos = await mediator.query(
        ListArtifacts(
            tenant_id=org.tenant_id,
            project_id=project_id,
            state_filter=state,
        )
    )
    return [
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
        )
        for d in dtos
    ]


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
            created_by=user.id,
        )
    )
    return ArtifactResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_type=dto.artifact_type,
        title=dto.title,
        description=dto.description,
        state=dto.state,
        assignee_id=dto.assignee_id,
        parent_id=dto.parent_id,
        custom_fields=dto.custom_fields,
    )


@router.get("/projects/{project_id}/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
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
    return ArtifactResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_type=dto.artifact_type,
        title=dto.title,
        description=dto.description,
        state=dto.state,
        assignee_id=dto.assignee_id,
        parent_id=dto.parent_id,
        custom_fields=dto.custom_fields,
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
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactResponse:
    dto = await mediator.send(
        TransitionArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            new_state=body.new_state,
            updated_by=user.id,
        )
    )
    return ArtifactResponse(
        id=dto.id,
        project_id=dto.project_id,
        artifact_type=dto.artifact_type,
        title=dto.title,
        description=dto.description,
        state=dto.state,
        assignee_id=dto.assignee_id,
        parent_id=dto.parent_id,
        custom_fields=dto.custom_fields,
    )


@router.get("/projects/{project_id}/manifest")
async def get_project_manifest(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("manifest:read"),
    mediator: Mediator = Depends(get_mediator),
) -> dict:
    """Get manifest bundle for the project's process template version."""
    manifest = await mediator.query(
        GetProjectManifest(tenant_id=org.tenant_id, project_id=project_id)
    )
    if manifest is None:
        raise EntityNotFound("ProjectManifest", project_id)
    return {
        "manifest_bundle": manifest.manifest_bundle,
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
) -> dict:
    projects = await mediator.query(ListProjects(tenant_id=org.tenant_id))
    return {
        "projects": len(projects),
        "artifacts": 0,
        "tasks": 0,
        "openDefects": 0,
    }


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
                    id=r.id, name=r.name, slug=r.slug,
                    is_system=r.is_system, hierarchy_level=r.hierarchy_level,
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
                id=r.id, name=r.name, slug=r.slug,
                is_system=r.is_system, hierarchy_level=r.hierarchy_level,
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
    await mediator.send(
        RemoveMember(tenant_id=org.tenant_id, user_id=user_id, removed_by=user.id)
    )
    return MessageResponse(message="Member removed")


@router.get("/members/{user_id}/roles", response_model=list[RoleInfoSchema])
async def get_member_roles(
    user_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("member:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[RoleInfoSchema]:
    dtos = await mediator.query(
        GetMemberRoles(tenant_id=org.tenant_id, user_id=user_id)
    )
    return [
        RoleInfoSchema(
            id=d.id, name=d.name, slug=d.slug,
            is_system=d.is_system, hierarchy_level=d.hierarchy_level,
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
                id=p.id, code=p.code, resource=p.resource,
                action=p.action, description=p.description,
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
