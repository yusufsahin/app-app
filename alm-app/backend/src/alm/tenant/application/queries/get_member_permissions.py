from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class GetMemberEffectivePermissions(Query):
    tenant_id: uuid.UUID
    user_id: uuid.UUID


class GetMemberEffectivePermissionsHandler(QueryHandler[list[str]]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, query: Query) -> list[str]:
        assert isinstance(query, GetMemberEffectivePermissions)
        membership = await self._membership_repo.find_by_user_and_tenant(query.user_id, query.tenant_id)
        if membership is None:
            raise EntityNotFound("TenantMembership", query.user_id)

        role_ids = await self._membership_repo.get_role_ids(membership.id)
        return await self._role_repo.get_privilege_codes_for_roles(role_ids)
