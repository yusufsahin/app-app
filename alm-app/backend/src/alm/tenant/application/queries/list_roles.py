from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.tenant.application.dtos import PrivilegeDTO, RoleDetailDTO
from alm.tenant.domain.ports import PrivilegeRepository, RoleRepository


@dataclass(frozen=True)
class ListTenantRoles(Query):
    tenant_id: uuid.UUID


class ListTenantRolesHandler(QueryHandler[list[RoleDetailDTO]]):
    def __init__(
        self,
        role_repo: RoleRepository,
        privilege_repo: PrivilegeRepository,
    ) -> None:
        self._role_repo = role_repo
        self._privilege_repo = privilege_repo

    async def handle(self, query: Query) -> list[RoleDetailDTO]:
        assert isinstance(query, ListTenantRoles)
        roles = await self._role_repo.find_all_by_tenant(query.tenant_id)
        result: list[RoleDetailDTO] = []

        for role in roles:
            privilege_ids = await self._role_repo.get_privilege_ids(role.id)
            privileges: list[PrivilegeDTO] = []
            for pid in privilege_ids:
                priv = await self._privilege_repo.find_by_id(pid)
                if priv is not None:
                    privileges.append(PrivilegeDTO(
                        id=priv.id,
                        code=priv.code,
                        resource=priv.resource,
                        action=priv.action,
                        description=priv.description,
                    ))

            result.append(RoleDetailDTO(
                id=role.id,
                name=role.name,
                slug=role.slug,
                description=role.description,
                is_system=role.is_system,
                hierarchy_level=role.hierarchy_level,
                privileges=privileges,
            ))

        return result
