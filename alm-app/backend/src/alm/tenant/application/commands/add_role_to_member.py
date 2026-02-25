from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.shared.domain.ports import IPermissionCache
from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class AddRoleToMember(Command):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role_id: uuid.UUID
    assigned_by: uuid.UUID


class AddRoleToMemberHandler(CommandHandler[None]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
        permission_cache: IPermissionCache,
    ) -> None:
        self._membership_repo = membership_repo
        self._role_repo = role_repo
        self._permission_cache = permission_cache

    async def handle(self, command: Command) -> None:
        assert isinstance(command, AddRoleToMember)

        membership = await self._membership_repo.find_by_user_and_tenant(command.user_id, command.tenant_id)
        if membership is None:
            raise EntityNotFound("TenantMembership", command.user_id)

        role = await self._role_repo.find_by_id(command.role_id)
        if role is None or role.tenant_id != command.tenant_id:
            raise EntityNotFound("Role", command.role_id)

        await self._membership_repo.add_role(membership.id, command.role_id, assigned_by=command.assigned_by)

        try:
            await self._permission_cache.invalidate_user(command.tenant_id, command.user_id)
        except Exception:
            pass
