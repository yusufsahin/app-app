"""Get tenant by slug query."""

from __future__ import annotations

from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.application.dtos import TenantDTO
from alm.tenant.domain.ports import TenantRepository


@dataclass(frozen=True)
class GetTenantBySlug(Query):
    slug: str


class GetTenantBySlugHandler(QueryHandler[TenantDTO]):
    def __init__(self, tenant_repo: TenantRepository) -> None:
        self._tenant_repo = tenant_repo

    async def handle(self, query: Query) -> TenantDTO:
        assert isinstance(query, GetTenantBySlug)

        tenant = await self._tenant_repo.find_by_slug(query.slug)
        if tenant is None:
            raise EntityNotFound("Tenant", query.slug)

        return TenantDTO(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            tier=tenant.tier,
        )
