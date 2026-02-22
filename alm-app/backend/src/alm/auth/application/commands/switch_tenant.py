from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, cast

from alm.auth.domain.entities import RefreshToken as RefreshTokenEntity
from alm.auth.application.dtos import TokenPairDTO
from alm.config.settings import settings
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import AccessDenied
from alm.shared.infrastructure.security.jwt import create_access_token, create_refresh_token_value

if TYPE_CHECKING:
    import uuid

    from alm.auth.domain.ports import RefreshTokenRepository
    from alm.tenant.domain.ports import MembershipRepository, RoleRepository


@dataclass(frozen=True)
class SwitchTenant(Command):
    user_id: uuid.UUID
    tenant_id: uuid.UUID


class SwitchTenantHandler(CommandHandler[TokenPairDTO]):
    def __init__(
        self,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
        refresh_token_repo: RefreshTokenRepository,
    ) -> None:
        self._membership_repo = membership_repo
        self._role_repo = role_repo
        self._refresh_token_repo = refresh_token_repo

    async def handle(self, command: Command) -> TokenPairDTO:
        cmd = cast("SwitchTenant", command)

        membership = await self._membership_repo.find_by_user_and_tenant(
            cmd.user_id, cmd.tenant_id
        )
        if membership is None:
            raise AccessDenied("You are not a member of the requested tenant.")

        roles = await self._role_repo.get_role_slugs_for_membership(membership.id)

        raw_refresh = create_refresh_token_value()
        token_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
        refresh_entity = RefreshTokenEntity(
            user_id=cmd.user_id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        await self._refresh_token_repo.add(refresh_entity)

        access_token = create_access_token(
            user_id=cmd.user_id,
            tenant_id=cmd.tenant_id,
            roles=roles,
        )

        return TokenPairDTO(access_token=access_token, refresh_token=raw_refresh)
