from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError
from alm.tenant.application.dtos import PrivilegeDTO, RoleDetailDTO
from alm.tenant.domain.entities import Role
from alm.tenant.domain.ports import PrivilegeRepository, RoleRepository


@dataclass(frozen=True)
class CreateRole(Command):
    tenant_id: uuid.UUID
    name: str
    slug: str
    description: str
    hierarchy_level: int
    privilege_ids: list[uuid.UUID]
    created_by: uuid.UUID


class CreateRoleHandler(CommandHandler[RoleDetailDTO]):
    def __init__(
        self,
        role_repo: RoleRepository,
        privilege_repo: PrivilegeRepository,
    ) -> None:
        self._role_repo = role_repo
        self._privilege_repo = privilege_repo

    async def handle(self, command: Command) -> RoleDetailDTO:
        assert isinstance(command, CreateRole)
        existing = await self._role_repo.find_by_slug(command.tenant_id, command.slug)
        if existing is not None:
            raise ConflictError(f"Role with slug '{command.slug}' already exists in this tenant")

        role = Role.create_custom(
            tenant_id=command.tenant_id,
            name=command.name,
            slug=command.slug,
            hierarchy_level=command.hierarchy_level,
            description=command.description,
        )
        role = await self._role_repo.add(role)

        if command.privilege_ids:
            await self._role_repo.set_privileges(role.id, list(command.privilege_ids))
            role.set_privileges(list(command.privilege_ids))

        privileges: list[PrivilegeDTO] = []
        for pid in command.privilege_ids or []:
            priv = await self._privilege_repo.find_by_id(pid)
            if priv is not None:
                privileges.append(
                    PrivilegeDTO(
                        id=priv.id,
                        code=priv.code,
                        resource=priv.resource,
                        action=priv.action,
                        description=priv.description,
                    )
                )

        return RoleDetailDTO(
            id=role.id,
            name=role.name,
            slug=role.slug,
            description=role.description,
            is_system=role.is_system,
            hierarchy_level=role.hierarchy_level,
            privileges=privileges,
        )
