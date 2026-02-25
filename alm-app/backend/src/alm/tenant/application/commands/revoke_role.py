from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound, ValidationError
from alm.shared.domain.ports import IPermissionCache
from alm.tenant.domain.ports import MembershipRepository


@dataclass(frozen=True)
class RevokeRole(Command):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role_id: uuid.UUID
    revoked_by: uuid.UUID


class RevokeRoleHandler(CommandHandler[None]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        permission_cache: IPermissionCache,
    ) -> None:
        self._membership_repo = membership_repo
        self._permission_cache = permission_cache

    async def handle(self, command: Command) -> None:
        assert isinstance(command, RevokeRole)
        membership = await self._membership_repo.find_by_user_and_tenant(command.user_id, command.tenant_id)
        if membership is None:
            raise EntityNotFound("TenantMembership", command.user_id)

        current_role_ids = await self._membership_repo.get_role_ids(membership.id)
        if command.role_id not in current_role_ids:
            raise ValidationError("User does not have this role")

        if len(current_role_ids) <= 1:
            raise ValidationError("Cannot revoke the last role from a member")

        await self._membership_repo.remove_role(membership.id, command.role_id)

        try:
            await self._permission_cache.invalidate_user(command.tenant_id, command.user_id)
        except Exception:
            pass
