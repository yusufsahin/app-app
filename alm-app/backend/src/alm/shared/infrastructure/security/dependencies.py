from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from alm.shared.domain.exceptions import AccessDenied
from alm.shared.infrastructure.security.jwt import InvalidTokenError, TokenPayload, decode_token

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer()


@dataclass
class CurrentUser:
    id: uuid.UUID
    tenant_id: uuid.UUID
    roles: list[str] = field(default_factory=list)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> CurrentUser:
    try:
        payload: TokenPayload = decode_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise AccessDenied(f"Invalid token: {exc}") from exc

    if payload.token_type != "access":
        raise AccessDenied("Token type must be 'access'")
    if payload.tid is None:
        raise AccessDenied("Token is missing tenant context")

    return CurrentUser(id=payload.sub, tenant_id=payload.tid, roles=payload.roles)


def _matches_permission(codes: list[str], required_code: str) -> bool:
    """Check if any of the privilege codes satisfy the required permission."""
    if "*" in codes:
        return True
    required_resource = required_code.split(":")[0]
    for code in codes:
        if code == required_code:
            return True
        if code == f"{required_resource}:*":
            return True
    return False


def require_permission(permission: str):
    """FastAPI dependency that checks whether the current user has a specific permission.

    Creates a fresh DB session per-request to resolve role→privilege mapping.
    """

    async def _checker(
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        from alm.shared.infrastructure.cache import PermissionCache
        from alm.shared.infrastructure.db.session import async_session_factory
        from alm.tenant.domain.services import PermissionResolver
        from alm.tenant.infrastructure.repositories import (
            SqlAlchemyMembershipRepository,
            SqlAlchemyRoleRepository,
        )

        cached_codes: list[str] | None = None
        cache = PermissionCache()
        try:
            cached_codes = await cache.get(user.tenant_id, user.id)
        except Exception:
            logger.warning("Redis cache read failed, falling back to DB", exc_info=True)

        if cached_codes is not None:
            if not _matches_permission(cached_codes, permission):
                raise AccessDenied(f"Missing permission: {permission}")
            return user

        async with async_session_factory() as session:
            membership_repo = SqlAlchemyMembershipRepository(session)
            role_repo = SqlAlchemyRoleRepository(session)
            resolver = PermissionResolver(role_repo)

            membership = await membership_repo.find_by_user_and_tenant(user.id, user.tenant_id)
            if membership is None:
                raise AccessDenied("Not a member of this tenant")

            role_ids = await membership_repo.get_role_ids(membership.id)
            codes = await resolver.get_effective_privileges(role_ids)

            try:
                await cache.set(user.tenant_id, user.id, codes)
            except Exception:
                logger.warning("Redis cache write failed", exc_info=True)

            if not _matches_permission(codes, permission):
                raise AccessDenied(f"Missing permission: {permission}")

        return user

    return Depends(_checker)


def require_any_role(*role_slugs: str):
    """FastAPI dependency that checks whether the user has at least one of the given roles."""

    async def _checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not any(r in user.roles for r in role_slugs):
            raise AccessDenied(f"Requires one of roles: {', '.join(role_slugs)}")
        return user

    return Depends(_checker)
