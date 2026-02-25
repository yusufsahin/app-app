"""G2: Soft-delete a user (admin only). Cannot delete self or last admin in tenant."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import AccessDenied, EntityNotFound, ValidationError

if TYPE_CHECKING:
    from alm.auth.domain.ports import UserRepository
from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class SoftDeleteUser(Command):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    deleted_by: uuid.UUID


class SoftDeleteUserHandler(CommandHandler[None]):
    def __init__(
        self,
        user_repo: UserRepository,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._user_repo = user_repo
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, command: Command) -> None:
        assert isinstance(command, SoftDeleteUser)
        if command.user_id == command.deleted_by:
            raise ValidationError("Cannot delete your own account.")
        membership = await self._membership_repo.find_by_user_and_tenant(command.user_id, command.tenant_id)
        if membership is None:
            raise EntityNotFound("User", str(command.user_id))
        user = await self._user_repo.find_by_id(command.user_id, include_deleted=True)
        if user is None:
            raise EntityNotFound("User", str(command.user_id))
        if user.deleted_at is not None:
            raise ValidationError("User is already deleted.")
        role_ids = await self._membership_repo.get_role_ids(membership.id)
        is_admin = False
        for role_id in role_ids:
            role = await self._role_repo.find_by_id(role_id)
            if role is not None and role.slug == "admin":
                is_admin = True
                break
        if is_admin:
            all_members = await self._membership_repo.find_all_by_tenant(command.tenant_id)
            admin_count = 0
            for m in all_members:
                if m.user_id == command.user_id:
                    continue
                rids = await self._membership_repo.get_role_ids(m.id)
                for rid in rids:
                    r = await self._role_repo.find_by_id(rid)
                    if r is not None and r.slug == "admin":
                        other_user = await self._user_repo.find_by_id(m.user_id, include_deleted=False)
                        if other_user is not None:
                            admin_count += 1
                        break
            if admin_count < 1:
                raise AccessDenied("Cannot delete the last admin from the tenant.")
        await self._user_repo.soft_delete(command.user_id, command.deleted_by)
