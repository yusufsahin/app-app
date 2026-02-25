from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.auth.application.dtos import CurrentUserDTO
from alm.auth.domain.ports import UserRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class UpdateProfile(Command):
    user_id: uuid.UUID
    tenant_id: uuid.UUID | None
    display_name: str


class UpdateProfileHandler(CommandHandler[CurrentUserDTO]):
    def __init__(
        self,
        user_repo: UserRepository,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._user_repo = user_repo
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, command: Command) -> CurrentUserDTO:
        assert isinstance(command, UpdateProfile)

        entity = await self._user_repo.find_by_id(command.user_id)
        if entity is None:
            raise EntityNotFound("User", command.user_id)

        entity.update_profile(display_name=command.display_name)
        await self._user_repo.update(entity)

        roles: list[str] = []
        permissions: list[str] = []
        if command.tenant_id is not None:
            membership = await self._membership_repo.find_by_user_and_tenant(command.user_id, command.tenant_id)
            if membership is not None:
                role_ids = await self._membership_repo.get_role_ids(membership.id)
                for rid in role_ids:
                    role = await self._role_repo.find_by_id(rid)
                    if role is not None:
                        roles.append(role.slug)
                permissions = await self._role_repo.get_privilege_codes_for_roles(role_ids)

        return CurrentUserDTO(
            id=entity.id,
            email=entity.email,
            display_name=entity.display_name,
            is_active=entity.is_active,
            roles=roles,
            permissions=permissions,
        )
