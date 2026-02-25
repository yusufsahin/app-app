"""Shared infrastructure ports — keep application layer independent of concrete implementations."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from collections.abc import Awaitable
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class IPasswordHasher(Protocol):
    """Port for password hashing and verification. Implemented in infrastructure."""

    def hash(self, plain_password: str) -> str: ...
    def verify(self, plain_password: str, hashed_password: str) -> bool: ...


class ITokenService(ABC):
    """Port for JWT / token creation. Implemented in infrastructure."""

    @abstractmethod
    def create_access_token(self, user_id: uuid.UUID, tenant_id: uuid.UUID, roles: list[str]) -> str: ...

    @abstractmethod
    def create_refresh_token_value(self) -> str: ...

    @abstractmethod
    def create_temp_token(self, user_id: uuid.UUID) -> str: ...


class IEmailSender(ABC):
    """Port for sending email. Implemented in infrastructure."""

    @abstractmethod
    def send(self, to: str, subject: str, html_body: str) -> Awaitable[None]: ...


class IPermissionCache(ABC):
    """Port for permission cache (e.g. Redis). Implemented in infrastructure."""

    @abstractmethod
    async def get(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[str] | None: ...

    @abstractmethod
    async def set(self, tenant_id: uuid.UUID, user_id: uuid.UUID, codes: list[str]) -> None: ...

    @abstractmethod
    async def invalidate_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> None: ...

    @abstractmethod
    async def invalidate_tenant(self, tenant_id: uuid.UUID) -> None: ...


class IManifestDefsFlattener(ABC):
    """Port for converting manifest defs format to flat (workflows, artifact_types, link_types). Implemented in artifact infrastructure."""

    @abstractmethod
    def flatten(self, manifest_bundle: dict[str, Any]) -> dict[str, Any]: ...


class IManifestACLChecker(ABC):
    """Port for manifest-based ACL (action/resource/actor_roles). Implemented in artifact infrastructure."""

    @abstractmethod
    def check(
        self,
        manifest_bundle: dict[str, Any],
        action: str,
        resource: str,
        actor_roles: list[str],
    ) -> tuple[bool, list[str]]: ...
