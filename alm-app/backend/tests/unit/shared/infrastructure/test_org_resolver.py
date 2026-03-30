from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from alm.shared.domain.exceptions import AccessDenied
from alm.shared.infrastructure.org_resolver import resolve_org
from alm.shared.infrastructure.security.dependencies import CurrentUser
from alm.tenant.application.dtos import TenantDTO
from alm.tenant.application.queries.get_tenant_by_slug import GetTenantBySlug


@pytest.mark.asyncio
async def test_resolve_org_returns_resolved_org_for_matching_tenant() -> None:
    tenant_id = uuid.uuid4()
    dto = TenantDTO(id=tenant_id, name="Acme", slug="acme", tier="pro")
    mediator = AsyncMock()
    mediator.query = AsyncMock(return_value=dto)
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=[])

    resolved = await resolve_org("acme", user=user, mediator=mediator)

    assert resolved.tenant_id == tenant_id
    assert resolved.slug == "acme"
    assert resolved.dto == dto
    mediator.query.assert_awaited_once()
    query = mediator.query.await_args.args[0]
    assert isinstance(query, GetTenantBySlug)
    assert query.slug == "acme"


@pytest.mark.asyncio
async def test_resolve_org_raises_access_denied_for_mismatched_tenant() -> None:
    dto = TenantDTO(id=uuid.uuid4(), name="Acme", slug="acme", tier="pro")
    mediator = AsyncMock()
    mediator.query = AsyncMock(return_value=dto)
    user = CurrentUser(id=uuid.uuid4(), tenant_id=uuid.uuid4(), roles=[])

    with pytest.raises(AccessDenied, match="switch to this organization first"):
        await resolve_org("acme", user=user, mediator=mediator)
