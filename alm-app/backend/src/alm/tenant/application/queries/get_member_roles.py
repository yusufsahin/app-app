from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.application.dtos import RoleInfoDTO
from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class GetMemberRoles(Query):
    tenant_id: uuid.UUID
    user_id: uuid.UUID


class GetMemberRolesHandler(QueryHandler[list[RoleInfoDTO]]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, query: Query) -> list[RoleInfoDTO]:
        assert isinstance(query, GetMemberRoles)

        membership = await self._membership_repo.find_by_user_and_tenant(query.user_id, query.tenant_id)
        if membership is None:
            raise EntityNotFound("TenantMembership", query.user_id)

        role_ids = await self._membership_repo.get_role_ids(membership.id)
        result: list[RoleInfoDTO] = []
        for role_id in role_ids:
            role = await self._role_repo.find_by_id(role_id)
            if role is not None:
                result.append(
                    RoleInfoDTO(
                        id=role.id,
                        name=role.name,
                        slug=role.slug,
                        is_system=role.is_system,
                        hierarchy_level=role.hierarchy_level,
                    )
                )
        return result
