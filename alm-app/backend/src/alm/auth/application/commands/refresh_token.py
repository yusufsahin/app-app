from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, cast

from alm.auth.domain.entities import RefreshToken as RefreshTokenEntity
from alm.auth.application.dtos import TokenPairDTO
from alm.config.settings import settings
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import AccessDenied, ValidationError
from alm.shared.infrastructure.security.jwt import create_access_token, create_refresh_token_value

if TYPE_CHECKING:
    import uuid

    from alm.auth.domain.ports import RefreshTokenRepository, UserRepository
    from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class RefreshTokenCommand(Command):
    refresh_token_value: str
    tenant_id: uuid.UUID | None = None


class RefreshTokenHandler(CommandHandler[TokenPairDTO]):
    """Validates an existing refresh token, revokes it, and issues a new token pair."""

    def __init__(
        self,
        refresh_token_repo: RefreshTokenRepository,
        user_repo: UserRepository,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
    ) -> None:
        self._refresh_token_repo = refresh_token_repo
        self._user_repo = user_repo
        self._membership_repo = membership_repo
        self._role_repo = role_repo

    async def handle(self, command: Command) -> TokenPairDTO:
        cmd = cast("RefreshTokenCommand", command)

        token_hash = hashlib.sha256(cmd.refresh_token_value.encode()).hexdigest()
        stored = await self._refresh_token_repo.find_by_token_hash(token_hash)
        if stored is None or not stored.is_valid:
            raise ValidationError("Refresh token is invalid or expired.")

        stored.revoke()
        await self._refresh_token_repo.revoke(stored)
        user = await self._user_repo.find_by_id(stored.user_id)
        if user is None or not user.is_active:
            raise AccessDenied("User account is inactive or deleted.")

        tenant_id = await self._resolve_tenant_id(stored.user_id, cmd.tenant_id)
        membership = await self._membership_repo.find_by_user_and_tenant(stored.user_id, tenant_id)
        if membership is None:
            raise AccessDenied("User is not a member of the tenant.")

        roles = await self._role_repo.get_role_slugs_for_membership(membership.id)

        new_raw = create_refresh_token_value()
        new_hash = hashlib.sha256(new_raw.encode()).hexdigest()
        new_entity = RefreshTokenEntity(
            user_id=stored.user_id,
            token_hash=new_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        await self._refresh_token_repo.add(new_entity)

        access_token = create_access_token(
            user_id=stored.user_id,
            tenant_id=tenant_id,
            roles=roles,
        )

        return TokenPairDTO(access_token=access_token, refresh_token=new_raw)

    async def _resolve_tenant_id(
        self, user_id: uuid.UUID, hint: uuid.UUID | None
    ) -> uuid.UUID:
        if hint is not None:
            return hint

        memberships = await self._membership_repo.find_all_by_user(user_id)
        if len(memberships) == 1:
            return memberships[0].tenant_id

        raise ValidationError(
            "Multiple tenants found. Please provide tenant context or re-authenticate."
        )
