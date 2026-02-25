from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.tenant.application.dtos import MemberDTO, RoleInfoDTO
from alm.tenant.domain.ports import MembershipRepository, RoleRepository, UserLookupPort


@dataclass(frozen=True)
class ListTenantMembers(Query):
    tenant_id: uuid.UUID


class ListTenantMembersHandler(QueryHandler[list[MemberDTO]]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
        user_lookup: UserLookupPort,
    ) -> None:
        self._membership_repo = membership_repo
        self._role_repo = role_repo
        self._user_lookup = user_lookup

    async def handle(self, query: Query) -> list[MemberDTO]:
        assert isinstance(query, ListTenantMembers)
        memberships = await self._membership_repo.find_all_by_tenant(query.tenant_id)
        result: list[MemberDTO] = []

        for membership in memberships:
            user_info = await self._user_lookup.find_by_id(membership.user_id)
            if user_info is None:
                continue

            role_ids = await self._membership_repo.get_role_ids(membership.id)
            roles: list[RoleInfoDTO] = []
            for role_id in role_ids:
                role = await self._role_repo.find_by_id(role_id)
                if role is not None:
                    roles.append(
                        RoleInfoDTO(
                            id=role.id,
                            name=role.name,
                            slug=role.slug,
                            is_system=role.is_system,
                            hierarchy_level=role.hierarchy_level,
                        )
                    )

            result.append(
                MemberDTO(
                    user_id=membership.user_id,
                    email=user_info.email,
                    display_name=user_info.display_name,
                    roles=roles,
                    joined_at=membership.joined_at,
                )
            )

        return result
