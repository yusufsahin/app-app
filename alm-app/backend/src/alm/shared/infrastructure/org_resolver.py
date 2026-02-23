"""Resolve org_slug to tenant_id and validate user access (Azure DevOps style)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends

from alm.shared.domain.exceptions import AccessDenied, EntityNotFound
from alm.shared.infrastructure.security.dependencies import (
    CurrentUser,
    get_current_user,
)
from alm.tenant.application.dtos import TenantDTO
from alm.tenant.application.queries.get_tenant_by_slug import GetTenantBySlug
from alm.config.dependencies import get_mediator
from alm.shared.application.mediator import Mediator


@dataclass
class ResolvedOrg:
    """Resolved org (tenant) from org_slug with access validation."""

    tenant_id: uuid.UUID
    slug: str
    dto: TenantDTO


async def resolve_org(
    org_slug: str,
    user: CurrentUser = Depends(get_current_user),
    mediator: Mediator = Depends(get_mediator),
) -> ResolvedOrg:
    """Resolve org_slug to tenant and ensure current user has access.

    User must have switched to this tenant (JWT tid matches).
    """
    dto: TenantDTO = await mediator.query(GetTenantBySlug(slug=org_slug))
    if user.tenant_id != dto.id:
        raise AccessDenied(
            f"Cannot access org '{org_slug}'; switch to this organization first",
        )
    return ResolvedOrg(tenant_id=dto.id, slug=org_slug, dto=dto)
