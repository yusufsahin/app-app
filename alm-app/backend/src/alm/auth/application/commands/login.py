from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, cast

from alm.auth.domain.entities import RefreshToken as RefreshTokenEntity
from alm.auth.application.dtos import LoginResultDTO, TenantInfoDTO, TokenPairDTO
from alm.config.settings import settings
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import AccessDenied, ValidationError
from alm.shared.infrastructure.security.jwt import (
    create_access_token,
    create_refresh_token_value,
    create_temp_token,
)
from alm.shared.infrastructure.security.password import verify_password

if TYPE_CHECKING:
    import uuid

    from alm.auth.domain.ports import RefreshTokenRepository, UserRepository
    from alm.tenant.domain.entities import TenantMembership
    from alm.tenant.domain.ports import MembershipRepository, RoleRepository, TenantRepository


@dataclass(frozen=True)
class Login(Command):
    email: str
    password: str


class LoginHandler(CommandHandler[LoginResultDTO]):
    def __init__(
        self,
        user_repo: UserRepository,
        refresh_token_repo: RefreshTokenRepository,
        membership_repo: MembershipRepository,
        role_repo: RoleRepository,
        tenant_repo: TenantRepository,
    ) -> None:
        self._user_repo = user_repo
        self._refresh_token_repo = refresh_token_repo
        self._membership_repo = membership_repo
        self._role_repo = role_repo
        self._tenant_repo = tenant_repo

    async def handle(self, command: Command) -> LoginResultDTO:
        cmd = cast("Login", command)

        user = await self._user_repo.find_by_email(cmd.email)
        if user is None or not verify_password(cmd.password, user.password_hash):
            raise ValidationError("Invalid email or password.")

        if not user.is_active:
            raise AccessDenied("Account is deactivated.")

        memberships = await self._membership_repo.find_all_by_user(user.id)
        if not memberships:
            raise AccessDenied("No tenant memberships found for this user.")

        if len(memberships) == 1:
            token_pair = await self._issue_token_pair(user.id, memberships[0])
            return LoginResultDTO(token_pair=token_pair)

        tenant_list: list[TenantInfoDTO] = []
        for membership in memberships:
            tenant = await self._tenant_repo.find_by_id(membership.tenant_id)
            if tenant is None:
                continue
            roles = await self._role_repo.get_role_slugs_for_membership(membership.id)
            tenant_list.append(
                TenantInfoDTO(
                    tenant_id=str(tenant.id),
                    tenant_name=tenant.name,
                    tenant_slug=tenant.slug,
                    roles=roles,
                )
            )

        temp_token = create_temp_token(user.id)
        return LoginResultDTO(
            requires_tenant_selection=True,
            tenants=tenant_list,
            temp_token=temp_token,
        )

    async def _issue_token_pair(
        self,
        user_id: uuid.UUID,
        membership: TenantMembership,
    ) -> TokenPairDTO:
        roles = await self._role_repo.get_role_slugs_for_membership(membership.id)

        raw_refresh = create_refresh_token_value()
        token_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
        refresh_entity = RefreshTokenEntity(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        await self._refresh_token_repo.add(refresh_entity)

        access_token = create_access_token(
            user_id=user_id,
            tenant_id=membership.tenant_id,
            roles=roles,
        )
        return TokenPairDTO(access_token=access_token, refresh_token=raw_refresh)
