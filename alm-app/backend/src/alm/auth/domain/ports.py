from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

from alm.auth.domain.entities import RefreshToken, User


@dataclass(frozen=True)
class UserCreationResult:
    """Result of creating a user via IUserCreationPort; keeps Tenant BC independent of User entity."""

    user_id: uuid.UUID
    email: str
    display_name: str


@dataclass(frozen=True)
class ProvisionedTenant:
    """Result of tenant provisioning — returned by OnboardingPort."""

    tenant_id: uuid.UUID
    slug: str
    tier: str
    roles: list[str]


class OnboardingPort(ABC):
    """Port for tenant provisioning. Implemented by Tenant BC's TenantOnboardingSaga.
    Auth BC depends on this port, NOT on Tenant domain directly."""

    @abstractmethod
    async def provision_tenant(self, name: str, admin_user_id: uuid.UUID) -> ProvisionedTenant: ...


class UserRepository(ABC):
    @abstractmethod
    async def find_by_id(self, user_id: uuid.UUID, include_deleted: bool = False) -> User | None: ...

    @abstractmethod
    async def find_by_email(self, email: str) -> User | None: ...

    @abstractmethod
    async def add(self, user: User) -> User: ...

    @abstractmethod
    async def update(self, user: User) -> User: ...

    @abstractmethod
    async def find_all(self, include_deleted: bool = False) -> list[User]: ...

    @abstractmethod
    async def soft_delete(self, user_id: uuid.UUID, deleted_by: uuid.UUID) -> None: ...


class RefreshTokenRepository(ABC):
    @abstractmethod
    async def add(self, token: RefreshToken) -> RefreshToken: ...

    @abstractmethod
    async def find_by_token_hash(self, token_hash: str) -> RefreshToken | None: ...

    @abstractmethod
    async def revoke(self, token: RefreshToken) -> None: ...

    @abstractmethod
    async def revoke_all_for_user(self, user_id: uuid.UUID) -> None: ...


class IUserCreationPort(ABC):
    """Port for ensuring a user exists (create or return existing). Implemented by Auth; Tenant BC uses this instead of User entity."""

    @abstractmethod
    async def ensure_user(
        self,
        email: str,
        display_name: str,
        password_hash: str,
    ) -> UserCreationResult: ...
