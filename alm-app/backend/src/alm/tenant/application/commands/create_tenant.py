from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.value_objects import Slug
from alm.tenant.application.dtos import TenantDTO
from alm.tenant.domain.entities import Tenant
from alm.tenant.domain.ports import (
    MembershipRepository,
    PrivilegeRepository,
    RoleRepository,
    TenantRepository,
)
from alm.tenant.domain.services import TenantOnboardingSaga


@dataclass(frozen=True)
class CreateTenant(Command):
    name: str
    admin_user_id: uuid.UUID


class CreateTenantHandler(CommandHandler[TenantDTO]):
    def __init__(
        self,
        tenant_repo: TenantRepository,
        role_repo: RoleRepository,
        privilege_repo: PrivilegeRepository,
        membership_repo: MembershipRepository,
    ) -> None:
        self._tenant_repo = tenant_repo
        self._role_repo = role_repo
        self._privilege_repo = privilege_repo
        self._membership_repo = membership_repo

    async def handle(self, command: Command) -> TenantDTO:
        assert isinstance(command, CreateTenant)
        slug = Slug.from_string(command.name)
        tenant = Tenant.create(name=command.name, slug=slug.value)

        saga = TenantOnboardingSaga(
            tenant_repo=self._tenant_repo,
            role_repo=self._role_repo,
            privilege_repo=self._privilege_repo,
            membership_repo=self._membership_repo,
        )
        await saga.execute(tenant, admin_user_id=command.admin_user_id)

        return TenantDTO(id=tenant.id, name=tenant.name, slug=tenant.slug, tier=tenant.tier)
