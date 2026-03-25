"""Org API routes: Members."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

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
