from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.application.dtos import PrivilegeDTO, RoleDetailDTO
from alm.tenant.domain.ports import PrivilegeRepository, RoleRepository


@dataclass(frozen=True)
class SetRolePrivileges(Command):
    role_id: uuid.UUID
    privilege_ids: list[uuid.UUID]
    updated_by: uuid.UUID


class SetRolePrivilegesHandler(CommandHandler[RoleDetailDTO]):
    def __init__(
        self,
        role_repo: RoleRepository,
        privilege_repo: PrivilegeRepository,
    ) -> None:
        self._role_repo = role_repo
        self._privilege_repo = privilege_repo

    async def handle(self, command: Command) -> RoleDetailDTO:
        assert isinstance(command, SetRolePrivileges)
        role = await self._role_repo.find_by_id(command.role_id)
        if role is None:
            raise EntityNotFound("Role", command.role_id)

        for pid in command.privilege_ids:
            privilege = await self._privilege_repo.find_by_id(pid)
            if privilege is None:
                raise EntityNotFound("Privilege", pid)

        role.set_privileges(list(command.privilege_ids))
        await self._role_repo.set_privileges(command.role_id, list(command.privilege_ids))
        await self._role_repo.update(role)

        privileges: list[PrivilegeDTO] = []
        for pid in command.privilege_ids:
            priv = await self._privilege_repo.find_by_id(pid)
            if priv is not None:
                privileges.append(PrivilegeDTO(
                    id=priv.id,
                    code=priv.code,
                    resource=priv.resource,
                    action=priv.action,
                    description=priv.description,
                ))

        from alm.shared.infrastructure.cache import PermissionCache

        try:
            await PermissionCache().invalidate_tenant(role.tenant_id)
        except Exception:
            pass

        return RoleDetailDTO(
            id=role.id,
            name=role.name,
            slug=role.slug,
            description=role.description,
            is_system=role.is_system,
            hierarchy_level=role.hierarchy_level,
            privileges=privileges,
        )
