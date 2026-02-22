from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from alm.tenant.domain.entities import Invitation, Privilege, Role, Tenant, TenantMembership


class TenantRepository(ABC):
    @abstractmethod
    async def find_by_id(self, tenant_id: uuid.UUID) -> Tenant | None: ...

    @abstractmethod
    async def find_by_slug(self, slug: str) -> Tenant | None: ...

    @abstractmethod
    async def add(self, tenant: Tenant) -> Tenant: ...

    @abstractmethod
    async def update(self, tenant: Tenant) -> Tenant: ...


class MembershipRepository(ABC):
    @abstractmethod
    async def find_by_id(self, membership_id: uuid.UUID) -> TenantMembership | None: ...

    @abstractmethod
    async def find_by_user_and_tenant(
        self, user_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> TenantMembership | None: ...

    @abstractmethod
    async def find_all_by_user(self, user_id: uuid.UUID) -> list[TenantMembership]: ...

    @abstractmethod
    async def find_all_by_tenant(self, tenant_id: uuid.UUID) -> list[TenantMembership]: ...

    @abstractmethod
    async def add(self, membership: TenantMembership) -> TenantMembership: ...

    @abstractmethod
    async def soft_delete(self, membership_id: uuid.UUID, deleted_by: uuid.UUID) -> None: ...

    # ── Role assignment ──

    @abstractmethod
    async def get_role_ids(self, membership_id: uuid.UUID) -> list[uuid.UUID]: ...

    @abstractmethod
    async def set_roles(
        self,
        membership_id: uuid.UUID,
        role_ids: list[uuid.UUID],
        assigned_by: uuid.UUID,
    ) -> None: ...

    @abstractmethod
    async def add_role(
        self,
        membership_id: uuid.UUID,
        role_id: uuid.UUID,
        assigned_by: uuid.UUID,
    ) -> None: ...

    @abstractmethod
    async def remove_role(self, membership_id: uuid.UUID, role_id: uuid.UUID) -> None: ...


class RoleRepository(ABC):
    @abstractmethod
    async def find_by_id(self, role_id: uuid.UUID) -> Role | None: ...

    @abstractmethod
    async def find_by_slug(self, tenant_id: uuid.UUID, slug: str) -> Role | None: ...

    @abstractmethod
    async def find_all_by_tenant(self, tenant_id: uuid.UUID) -> list[Role]: ...

    @abstractmethod
    async def add(self, role: Role) -> Role: ...

    @abstractmethod
    async def update(self, role: Role) -> Role: ...

    @abstractmethod
    async def soft_delete(self, role_id: uuid.UUID, deleted_by: uuid.UUID) -> None: ...

    @abstractmethod
    async def set_privileges(self, role_id: uuid.UUID, privilege_ids: list[uuid.UUID]) -> None: ...

    @abstractmethod
    async def get_privilege_ids(self, role_id: uuid.UUID) -> list[uuid.UUID]: ...

    @abstractmethod
    async def get_role_slugs_for_membership(self, membership_id: uuid.UUID) -> list[str]: ...

    @abstractmethod
    async def get_privilege_codes_for_roles(self, role_ids: list[uuid.UUID]) -> list[str]: ...


class PrivilegeRepository(ABC):
    @abstractmethod
    async def find_by_id(self, privilege_id: uuid.UUID) -> Privilege | None: ...

    @abstractmethod
    async def find_by_code(self, code: str) -> Privilege | None: ...

    @abstractmethod
    async def find_all(self) -> list[Privilege]: ...

    @abstractmethod
    async def find_by_codes(self, codes: list[str]) -> list[Privilege]: ...

    @abstractmethod
    async def add(self, privilege: Privilege) -> Privilege: ...

    @abstractmethod
    async def add_many(self, privileges: list[Privilege]) -> None: ...


class InvitationRepository(ABC):
    @abstractmethod
    async def find_by_id(self, invitation_id: uuid.UUID) -> Invitation | None: ...

    @abstractmethod
    async def find_by_token(self, token: str) -> Invitation | None: ...

    @abstractmethod
    async def find_pending_by_email_and_tenant(
        self, email: str, tenant_id: uuid.UUID
    ) -> Invitation | None: ...

    @abstractmethod
    async def add(self, invitation: Invitation) -> Invitation: ...

    @abstractmethod
    async def update(self, invitation: Invitation) -> Invitation: ...
