from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.domain.ports import RoleRepository


@dataclass(frozen=True)
class DeleteRole(Command):
    role_id: uuid.UUID
    deleted_by: uuid.UUID


class DeleteRoleHandler(CommandHandler[None]):
    def __init__(self, role_repo: RoleRepository) -> None:
        self._role_repo = role_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, DeleteRole)
        role = await self._role_repo.find_by_id(command.role_id)
        if role is None:
            raise EntityNotFound("Role", command.role_id)

        role.validate_can_delete()
        await self._role_repo.soft_delete(command.role_id, deleted_by=command.deleted_by)
