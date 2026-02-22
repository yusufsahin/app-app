from __future__ import annotations

import uuid
from pathlib import Path

import yaml

from alm.auth.domain.ports import OnboardingPort, ProvisionedTenant
from alm.tenant.domain.entities import Privilege, Role, Tenant, TenantMembership
from alm.tenant.domain.ports import (
    MembershipRepository,
    PrivilegeRepository,
    RoleRepository,
    TenantRepository,
)

_SEED_DIR = Path(__file__).resolve().parents[4] / "alm_meta" / "seed"


class TenantOnboardingSaga(OnboardingPort):
    """Seeds a new tenant with system roles, privilege mappings, and admin membership."""

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

    async def provision_tenant(
        self, name: str, admin_user_id: uuid.UUID
    ) -> ProvisionedTenant:
        """Implementation of OnboardingPort — creates tenant, seeds roles, assigns admin."""
        from alm.shared.domain.value_objects import Slug

        slug = Slug.from_string(name)
        tenant = Tenant.create(name=name, slug=slug.value)
        await self._tenant_repo.add(tenant)
        role_map = await self._seed_system_roles(tenant.id)
        admin_role = role_map.get("admin")
        if admin_role is None:
            raise RuntimeError("admin role not found in seed data")

        membership = TenantMembership(user_id=admin_user_id, tenant_id=tenant.id)
        membership = await self._membership_repo.add(membership)
        await self._membership_repo.add_role(membership.id, admin_role.id, assigned_by=admin_user_id)
        return ProvisionedTenant(tenant_id=tenant.id, roles=["admin"])

    async def _seed_system_roles(self, tenant_id: uuid.UUID) -> dict[str, Role]:
        with open(_SEED_DIR / "default_roles.yaml") as f:
            data = yaml.safe_load(f)

        all_privileges = await self._privilege_repo.find_all()
        priv_by_code = {p.code: p for p in all_privileges}

        role_map: dict[str, Role] = {}
        for role_def in data["roles"]:
            role = Role.create_system(
                tenant_id=tenant_id,
                name=role_def["name"],
                slug=role_def["slug"],
                hierarchy_level=role_def["hierarchy_level"],
                description=role_def.get("description", ""),
            )
            role = await self._role_repo.add(role)

            privilege_codes: list[str] = role_def.get("privileges", [])
            if "*" in privilege_codes:
                priv_ids = [p.id for p in all_privileges]
            else:
                priv_ids = self._resolve_privilege_ids(privilege_codes, priv_by_code)

            if priv_ids:
                await self._role_repo.set_privileges(role.id, priv_ids)

            role_map[role.slug] = role

        return role_map

    def _resolve_privilege_ids(
        self,
        codes: list[str],
        priv_by_code: dict[str, Privilege],
    ) -> list[uuid.UUID]:
        ids: list[uuid.UUID] = []
        for code in codes:
            if code.endswith(":*"):
                resource = code.split(":")[0]
                ids.extend(p.id for c, p in priv_by_code.items() if c.startswith(f"{resource}:"))
            elif code in priv_by_code:
                ids.append(priv_by_code[code].id)
        return ids


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
