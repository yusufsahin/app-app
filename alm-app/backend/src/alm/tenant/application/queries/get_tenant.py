from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.application.dtos import TenantDTO
from alm.tenant.domain.ports import TenantRepository


@dataclass(frozen=True)
class GetTenant(Query):
    tenant_id: uuid.UUID


class GetTenantHandler(QueryHandler[TenantDTO]):
    def __init__(self, tenant_repo: TenantRepository) -> None:
        self._tenant_repo = tenant_repo

    async def handle(self, query: Query) -> TenantDTO:
        assert isinstance(query, GetTenant)

        tenant = await self._tenant_repo.find_by_id(query.tenant_id)
        if tenant is None:
            raise EntityNotFound("Tenant", query.tenant_id)

        return TenantDTO(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            tier=tenant.tier,
        )
