"""G3: Archive (soft-delete) a tenant. Admin of that tenant only."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import AccessDenied, EntityNotFound
from alm.tenant.domain.ports import MembershipRepository, RoleRepository, TenantRepository


@dataclass(frozen=True)
class ArchiveTenant(Command):
    tenant_id: uuid.UUID
    archived_by: uuid.UUID


class ArchiveTenantHandler(CommandHandler[None]):
    def __init__(
        self,
        tenant_repo: TenantRepository,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._tenant_repo = tenant_repo
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, ArchiveTenant)
        tenant = await self._tenant_repo.find_by_id(command.tenant_id)
        if tenant is None:
            raise EntityNotFound("Tenant", str(command.tenant_id))
        if tenant.deleted_at is not None:
            raise EntityNotFound("Tenant", str(command.tenant_id))
        membership = await self._membership_repo.find_by_user_and_tenant(
            command.archived_by, command.tenant_id
        )
        if membership is None:
            raise AccessDenied("You are not a member of this tenant.")
        role_ids = await self._membership_repo.get_role_ids(membership.id)
        is_admin = False
        for role_id in role_ids:
            role = await self._role_repo.find_by_id(role_id)
            if role is not None and role.slug == "admin":
                is_admin = True
                break
        if not is_admin:
            raise AccessDenied("Only an admin can archive this tenant.")
        await self._tenant_repo.soft_delete(command.tenant_id, command.archived_by)
