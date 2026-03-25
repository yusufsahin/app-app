"""Org API routes: Roles."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

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
