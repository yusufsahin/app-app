from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.tenant.application.dtos import TenantWithRolesDTO
from alm.tenant.domain.ports import MembershipRepository, RoleRepository, TenantRepository


@dataclass(frozen=True)
class ListMyTenants(Query):
    user_id: uuid.UUID


class ListMyTenantsHandler(QueryHandler[list[TenantWithRolesDTO]]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        tenant_repo: TenantRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._membership_repo = membership_repo
        self._tenant_repo = tenant_repo
        self._role_repo = role_repo

    async def handle(self, query: Query) -> list[TenantWithRolesDTO]:
        assert isinstance(query, ListMyTenants)
        memberships = await self._membership_repo.find_all_by_user(query.user_id)
        result: list[TenantWithRolesDTO] = []

        for membership in memberships:
            tenant = await self._tenant_repo.find_by_id(membership.tenant_id)
            if tenant is None:
                continue
            role_slugs = await self._role_repo.get_role_slugs_for_membership(membership.id)
            result.append(
                TenantWithRolesDTO(
                    id=tenant.id,
                    name=tenant.name,
                    slug=tenant.slug,
                    tier=tenant.tier,
                    roles=role_slugs,
                )
            )

        return result
