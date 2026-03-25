"""Org API routes: Org (tenant)."""

from fastapi import APIRouter

from alm.orgs.api._router_deps import *  # noqa: F403

router = APIRouter()

# ── Org (tenant) ──


@router.get("/", response_model=TenantResponse)
async def get_org(
    org: ResolvedOrg = Depends(resolve_org),
) -> TenantResponse:
    return TenantResponse(id=org.dto.id, name=org.dto.name, slug=org.dto.slug, tier=org.dto.tier)


@router.put("/", response_model=TenantResponse)
async def update_org(
    body: UpdateTenantRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("tenant:update"),
    mediator: Mediator = Depends(get_mediator),
) -> TenantResponse:
    dto: TenantDTO = await mediator.send(UpdateTenant(tenant_id=org.tenant_id, name=body.name, settings=body.settings))
    return TenantResponse(id=dto.id, name=dto.name, slug=dto.slug, tier=dto.tier)
