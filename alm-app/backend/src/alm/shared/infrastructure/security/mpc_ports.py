"""MPC GuardPort / AuthPort integration points.

When MPC (manifest-platform-core) exposes its port interfaces, alm-app will
implement them here using CurrentUser, PermissionResolver, and
_matches_permission. See docs/D1_POLICY_ACL_INTEGRATION.md.
"""

from __future__ import annotations

import uuid
from typing import Protocol, runtime_checkable


@runtime_checkable
class AuthPort(Protocol):
    """Port for resolving user context and privileges (MPC AuthPort contract).

    Concrete implementation will use PermissionResolver + Redis cache to return
    effective privilege codes for a user in a tenant.
    """

    async def get_privileges(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[str]:
        """Return effective privilege codes for the user in the tenant (e.g. artifact:read, manifest:*)."""
        ...


@runtime_checkable
class GuardPort(Protocol):
    """Port for answering 'can user perform action (on resource)?' (MPC GuardPort contract).

    Concrete implementation will use AuthPort (or PermissionResolver) and
    _matches_permission to decide. Optional resource_type/resource_id allow
    future resource-level checks.
    """

    async def can(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        action: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> bool:
        """Return True if the user is allowed to perform the action (optionally on the given resource)."""
        ...


class AlmAppAuthPort:
    """AuthPort implementation using get_user_privileges (PermissionResolver + cache)."""

    async def get_privileges(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[str]:
        from alm.shared.infrastructure.security.dependencies import get_user_privileges

        return await get_user_privileges(tenant_id, user_id)


class AlmAppGuardPort:
    """GuardPort implementation using AuthPort and _matches_permission."""

    def __init__(self, auth_port: AuthPort) -> None:
        self._auth = auth_port

    async def can(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        action: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> bool:
        from alm.shared.infrastructure.security.dependencies import _matches_permission

        codes = await self._auth.get_privileges(tenant_id, user_id)
        return _matches_permission(codes, action)
