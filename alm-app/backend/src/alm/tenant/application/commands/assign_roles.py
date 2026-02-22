from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import AccessDenied, EntityNotFound
from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class AssignRoles(Command):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role_ids: list[uuid.UUID]
    assigned_by: uuid.UUID


class AssignRolesHandler(CommandHandler[None]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, AssignRoles)
        membership = await self._membership_repo.find_by_user_and_tenant(
            command.user_id, command.tenant_id
        )
        if membership is None:
            raise EntityNotFound("TenantMembership", command.user_id)

        for role_id in command.role_ids:
            role = await self._role_repo.find_by_id(role_id)
            if role is None or role.tenant_id != command.tenant_id:
                raise EntityNotFound("Role", role_id)

        assigner_membership = await self._membership_repo.find_by_user_and_tenant(
            command.assigned_by, command.tenant_id
        )
        if assigner_membership is not None:
            assigner_role_ids = await self._membership_repo.get_role_ids(assigner_membership.id)
            assigner_min_level = 100
            for rid in assigner_role_ids:
                r = await self._role_repo.find_by_id(rid)
                if r is not None and r.hierarchy_level < assigner_min_level:
                    assigner_min_level = r.hierarchy_level

            for role_id in command.role_ids:
                role = await self._role_repo.find_by_id(role_id)
                if role is not None and role.hierarchy_level < assigner_min_level:
                    raise AccessDenied(
                        f"Cannot assign role '{role.name}' (level {role.hierarchy_level}) "
                        f"— your highest role is level {assigner_min_level}"
                    )

        await self._membership_repo.set_roles(
            membership.id, command.role_ids, assigned_by=command.assigned_by
        )

        from alm.shared.infrastructure.cache import PermissionCache

        try:
            await PermissionCache().invalidate_user(command.tenant_id, command.user_id)
        except Exception:
            pass
