from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound, ValidationError
from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class RemoveMember(Command):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    removed_by: uuid.UUID


class RemoveMemberHandler(CommandHandler[None]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, RemoveMember)
        membership = await self._membership_repo.find_by_user_and_tenant(command.user_id, command.tenant_id)
        if membership is None:
            raise EntityNotFound("TenantMembership", command.user_id)

        if command.user_id == command.removed_by:
            role_slugs = await self._role_repo.get_role_slugs_for_membership(membership.id)
            if "admin" in role_slugs:
                all_memberships = await self._membership_repo.find_all_by_tenant(command.tenant_id)
                admin_count = 0
                for m in all_memberships:
                    slugs = await self._role_repo.get_role_slugs_for_membership(m.id)
                    if "admin" in slugs:
                        admin_count += 1
                if admin_count <= 1:
                    raise ValidationError("Cannot remove yourself as the last admin of the tenant")

        await self._membership_repo.soft_delete(membership.id, deleted_by=command.removed_by)
