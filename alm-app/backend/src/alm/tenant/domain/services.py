from __future__ import annotations

import uuid

from alm.tenant.domain.ports import RoleRepository


class PermissionResolver:
    """Resolves effective permissions from a set of role slugs."""

    def __init__(self, role_repo: RoleRepository) -> None:
        self._role_repo = role_repo

    async def get_role_slugs(self, membership_id: uuid.UUID) -> list[str]:
        return await self._role_repo.get_role_slugs_for_membership(membership_id)

    async def get_effective_privileges(self, role_ids: list[uuid.UUID]) -> list[str]:
        return await self._role_repo.get_privilege_codes_for_roles(role_ids)

    async def has_privilege(self, role_ids: list[uuid.UUID], required_code: str) -> bool:
        codes = await self.get_effective_privileges(role_ids)
        if "*" in codes:
            return True
        required_resource = required_code.split(":")[0]
        for code in codes:
            if code == required_code:
                return True
            if code == f"{required_resource}:*":
                return True
        return False
