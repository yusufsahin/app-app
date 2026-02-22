from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.application.dtos import PrivilegeDTO, RoleDetailDTO
from alm.tenant.domain.ports import PrivilegeRepository, RoleRepository


@dataclass(frozen=True)
class GetRole(Query):
    role_id: uuid.UUID


class GetRoleHandler(QueryHandler[RoleDetailDTO]):
    def __init__(
        self,
        role_repo: RoleRepository,
        privilege_repo: PrivilegeRepository,
    ) -> None:
        self._role_repo = role_repo
        self._privilege_repo = privilege_repo

    async def handle(self, query: Query) -> RoleDetailDTO:
        assert isinstance(query, GetRole)
        role = await self._role_repo.find_by_id(query.role_id)
        if role is None:
            raise EntityNotFound("Role", query.role_id)

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

        return RoleDetailDTO(
            id=role.id,
            name=role.name,
            slug=role.slug,
            description=role.description,
            is_system=role.is_system,
            hierarchy_level=role.hierarchy_level,
            privileges=privileges,
        )
