from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from alm.auth.api.schemas import MessageResponse
from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import EntityNotFound
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    get_current_user,
    require_permission,
)
from alm.tenant.api.schemas import (
    AcceptInviteRequest,
    AddRoleRequest,
    AssignRolesRequest,
    CreateRoleRequest,
    CreateTenantRequest,
    InvitationResponse,
    InviteMemberRequest,
    MemberResponse,
    PrivilegeSchema,
    RoleDetailResponse,
    RoleInfoSchema,
    SetRolePrivilegesRequest,
    TenantResponse,
    TenantWithRolesResponse,
    UpdateRoleRequest,
    UpdateTenantRequest,
)
from alm.tenant.application.commands.accept_invite import AcceptInvite
from alm.tenant.application.commands.assign_roles import AssignRoles
from alm.tenant.application.commands.create_role import CreateRole
from alm.tenant.application.commands.create_tenant import CreateTenant
from alm.tenant.application.commands.delete_role import DeleteRole
from alm.tenant.application.commands.invite_member import InviteMember
from alm.tenant.application.commands.remove_member import RemoveMember
from alm.tenant.application.commands.revoke_role import RevokeRole
from alm.tenant.application.commands.set_role_privileges import SetRolePrivileges
from alm.tenant.application.commands.update_role import UpdateRole
from alm.tenant.application.dtos import (
    InvitationDTO,
    MemberDTO,
    PrivilegeDTO,
    RoleDetailDTO,
    TenantDTO,
    TenantWithRolesDTO,
)
from alm.tenant.application.queries.get_member_permissions import GetMemberEffectivePermissions
from alm.tenant.application.queries.get_role import GetRole
from alm.tenant.application.queries.list_members import ListTenantMembers
from alm.tenant.application.queries.list_privileges import ListPrivileges
from alm.tenant.application.queries.list_roles import ListTenantRoles
from alm.tenant.application.queries.list_tenants import ListMyTenants

router = APIRouter(prefix="/api/v1/tenants", tags=["tenants"])


# ── Tenant CRUD ──


@router.post("/", response_model=TenantResponse, status_code=201)
async def create_tenant(
    body: CreateTenantRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> TenantResponse:
    dto: TenantDTO = await mediator.send(CreateTenant(name=body.name, admin_user_id=user.id))
    return TenantResponse(id=dto.id, name=dto.name, slug=dto.slug, tier=dto.tier)


@router.get("/", response_model=list[TenantWithRolesResponse])
async def list_my_tenants(
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> list[TenantWithRolesResponse]:
    items: list[TenantWithRolesDTO] = await mediator.query(ListMyTenants(user_id=user.id))
    return [
        TenantWithRolesResponse(id=d.id, name=d.name, slug=d.slug, tier=d.tier, roles=d.roles)
        for d in items
    ]


@router.get("/privileges", response_model=list[PrivilegeSchema])
async def list_privileges(
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> list[PrivilegeSchema]:
    items: list[PrivilegeDTO] = await mediator.query(ListPrivileges())
    return [
        PrivilegeSchema(
            id=p.id, code=p.code, resource=p.resource, action=p.action, description=p.description
        )
        for p in items
    ]


@router.post("/accept-invite", response_model=MessageResponse)
async def accept_invite(
    body: AcceptInviteRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(AcceptInvite(token=body.token, user_id=user.id))
    return MessageResponse(message="Invitation accepted")


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> TenantResponse:
    from alm.tenant.infrastructure.repositories import SqlAlchemyTenantRepository

    tenant_repo = SqlAlchemyTenantRepository(mediator._session)
    tenant = await tenant_repo.find_by_id(tenant_id)
    if tenant is None:
        raise EntityNotFound("Tenant", tenant_id)
    return TenantResponse(id=tenant.id, name=tenant.name, slug=tenant.slug, tier=tenant.tier)


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: uuid.UUID,
    body: UpdateTenantRequest,
    user: CurrentUser = require_permission("tenant:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TenantResponse:
    from alm.tenant.infrastructure.repositories import SqlAlchemyTenantRepository

    tenant_repo = SqlAlchemyTenantRepository(mediator._session)
    tenant = await tenant_repo.find_by_id(tenant_id)
    if tenant is None:
        raise EntityNotFound("Tenant", tenant_id)
    tenant.update_settings(name=body.name, settings=body.settings)
    tenant = await tenant_repo.update(tenant)
    await mediator._session.commit()
    return TenantResponse(id=tenant.id, name=tenant.name, slug=tenant.slug, tier=tenant.tier)


# ── Members ──


@router.get("/{tenant_id}/members", response_model=list[MemberResponse])
async def list_members(
    tenant_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> list[MemberResponse]:
    items: list[MemberDTO] = await mediator.query(ListTenantMembers(tenant_id=tenant_id))
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


@router.post("/{tenant_id}/invite", response_model=InvitationResponse, status_code=201)
async def invite_member(
    tenant_id: uuid.UUID,
    body: InviteMemberRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> InvitationResponse:
    dto: InvitationDTO = await mediator.send(
        InviteMember(
            tenant_id=tenant_id,
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
                id=r.id, name=r.name, slug=r.slug, is_system=r.is_system, hierarchy_level=r.hierarchy_level
            )
            for r in dto.roles
        ],
        expires_at=dto.expires_at,
        accepted_at=dto.accepted_at,
    )


@router.delete("/{tenant_id}/members/{user_id}", response_model=MessageResponse)
async def remove_member(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(RemoveMember(tenant_id=tenant_id, user_id=user_id, removed_by=user.id))
    return MessageResponse(message="Member removed")


# ── Member roles ──


@router.get("/{tenant_id}/members/{user_id}/roles", response_model=list[RoleInfoSchema])
async def get_member_roles(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> list[RoleInfoSchema]:
    from alm.tenant.infrastructure.repositories import (
        SqlAlchemyMembershipRepository,
        SqlAlchemyRoleRepository,
    )

    membership_repo = SqlAlchemyMembershipRepository(mediator._session)
    role_repo = SqlAlchemyRoleRepository(mediator._session)

    membership = await membership_repo.find_by_user_and_tenant(user_id, tenant_id)
    if membership is None:
        raise EntityNotFound("TenantMembership", user_id)

    role_ids = await membership_repo.get_role_ids(membership.id)
    roles: list[RoleInfoSchema] = []
    for role_id in role_ids:
        role = await role_repo.find_by_id(role_id)
        if role is not None:
            roles.append(
                RoleInfoSchema(
                    id=role.id,
                    name=role.name,
                    slug=role.slug,
                    is_system=role.is_system,
                    hierarchy_level=role.hierarchy_level,
                )
            )
    return roles


@router.put("/{tenant_id}/members/{user_id}/roles", response_model=MessageResponse)
async def assign_roles(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    body: AssignRolesRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(
        AssignRoles(
            tenant_id=tenant_id,
            user_id=user_id,
            role_ids=body.role_ids,
            assigned_by=user.id,
        )
    )
    return MessageResponse(message="Roles assigned")


@router.post("/{tenant_id}/members/{user_id}/roles", response_model=MessageResponse, status_code=201)
async def add_role_to_member(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    body: AddRoleRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    from alm.tenant.infrastructure.repositories import (
        SqlAlchemyMembershipRepository,
        SqlAlchemyRoleRepository,
    )

    membership_repo = SqlAlchemyMembershipRepository(mediator._session)
    role_repo = SqlAlchemyRoleRepository(mediator._session)

    membership = await membership_repo.find_by_user_and_tenant(user_id, tenant_id)
    if membership is None:
        raise EntityNotFound("TenantMembership", user_id)

    role = await role_repo.find_by_id(body.role_id)
    if role is None or role.tenant_id != tenant_id:
        raise EntityNotFound("Role", body.role_id)

    await membership_repo.add_role(membership.id, body.role_id, assigned_by=user.id)
    await mediator._session.commit()
    return MessageResponse(message="Role added")


@router.delete("/{tenant_id}/members/{user_id}/roles/{role_id}", response_model=MessageResponse)
async def revoke_role(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(
        RevokeRole(tenant_id=tenant_id, user_id=user_id, role_id=role_id, revoked_by=user.id)
    )
    return MessageResponse(message="Role revoked")


# ── Roles ──


@router.get("/{tenant_id}/roles", response_model=list[RoleDetailResponse])
async def list_roles(
    tenant_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> list[RoleDetailResponse]:
    items: list[RoleDetailDTO] = await mediator.query(ListTenantRoles(tenant_id=tenant_id))
    return [
        RoleDetailResponse(
            id=d.id,
            name=d.name,
            slug=d.slug,
            description=d.description,
            is_system=d.is_system,
            hierarchy_level=d.hierarchy_level,
            privileges=[
                PrivilegeSchema(
                    id=p.id, code=p.code, resource=p.resource, action=p.action, description=p.description
                )
                for p in d.privileges
            ],
        )
        for d in items
    ]


@router.post("/{tenant_id}/roles", response_model=RoleDetailResponse, status_code=201)
async def create_role(
    tenant_id: uuid.UUID,
    body: CreateRoleRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> RoleDetailResponse:
    dto: RoleDetailDTO = await mediator.send(
        CreateRole(
            tenant_id=tenant_id,
            name=body.name,
            slug=body.slug,
            description=body.description,
            hierarchy_level=body.hierarchy_level,
            privilege_ids=body.privilege_ids,
            created_by=user.id,
        )
    )
    return _role_detail_to_response(dto)


@router.get("/{tenant_id}/roles/{role_id}", response_model=RoleDetailResponse)
async def get_role(
    tenant_id: uuid.UUID,
    role_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> RoleDetailResponse:
    dto: RoleDetailDTO = await mediator.query(GetRole(role_id=role_id))
    return _role_detail_to_response(dto)


@router.put("/{tenant_id}/roles/{role_id}", response_model=RoleDetailResponse)
async def update_role(
    tenant_id: uuid.UUID,
    role_id: uuid.UUID,
    body: UpdateRoleRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> RoleDetailResponse:
    dto: RoleDetailDTO = await mediator.send(
        UpdateRole(
            role_id=role_id,
            name=body.name,
            description=body.description,
            hierarchy_level=body.hierarchy_level,
            updated_by=user.id,
        )
    )
    return _role_detail_to_response(dto)


@router.delete("/{tenant_id}/roles/{role_id}", response_model=MessageResponse)
async def delete_role(
    tenant_id: uuid.UUID,
    role_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> MessageResponse:
    await mediator.send(DeleteRole(role_id=role_id, deleted_by=user.id))
    return MessageResponse(message="Role deleted")


@router.put("/{tenant_id}/roles/{role_id}/privileges", response_model=RoleDetailResponse)
async def set_role_privileges(
    tenant_id: uuid.UUID,
    role_id: uuid.UUID,
    body: SetRolePrivilegesRequest,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> RoleDetailResponse:
    dto: RoleDetailDTO = await mediator.send(
        SetRolePrivileges(role_id=role_id, privilege_ids=body.privilege_ids, updated_by=user.id)
    )
    return _role_detail_to_response(dto)


# ── Helpers ──


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
                id=p.id, code=p.code, resource=p.resource, action=p.action, description=p.description
            )
            for p in dto.privileges
        ],
    )
