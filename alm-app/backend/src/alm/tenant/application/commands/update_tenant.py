from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound
from alm.tenant.application.dtos import TenantDTO
from alm.tenant.domain.ports import TenantRepository


@dataclass(frozen=True)
class UpdateTenant(Command):
    tenant_id: uuid.UUID
    name: str | None = None
    settings: dict[str, Any] | None = None


class UpdateTenantHandler(CommandHandler[TenantDTO]):
    def __init__(self, tenant_repo: TenantRepository) -> None:
        self._tenant_repo = tenant_repo

    async def handle(self, command: Command) -> TenantDTO:
        assert isinstance(command, UpdateTenant)

        tenant = await self._tenant_repo.find_by_id(command.tenant_id)
        if tenant is None:
            raise EntityNotFound("Tenant", command.tenant_id)

        tenant.update_settings(name=command.name, settings=command.settings)
        tenant = await self._tenant_repo.update(tenant)

        return TenantDTO(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            tier=tenant.tier,
        )
