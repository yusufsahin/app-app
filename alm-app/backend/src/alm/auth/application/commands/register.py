from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, cast

from alm.auth.application.dtos import TokenPairDTO
from alm.auth.domain.entities import RefreshToken as RefreshTokenEntity
from alm.auth.domain.entities import User
from alm.auth.domain.ports import OnboardingPort
from alm.config.settings import settings
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.shared.infrastructure.security.jwt import create_access_token, create_refresh_token_value
from alm.shared.infrastructure.security.password import hash_password

if TYPE_CHECKING:
    from alm.auth.domain.ports import RefreshTokenRepository, UserRepository


@dataclass(frozen=True)
class RegisterUser(Command):
    email: str
    password: str
    display_name: str
    org_name: str


class RegisterUserHandler(CommandHandler[TokenPairDTO]):
    def __init__(
        self,
        user_repo: UserRepository,
        refresh_token_repo: RefreshTokenRepository,
        onboarding: OnboardingPort,
    ) -> None:
        self._user_repo = user_repo
        self._refresh_token_repo = refresh_token_repo
        self._onboarding = onboarding

    async def handle(self, command: Command) -> TokenPairDTO:
        cmd = cast("RegisterUser", command)

        existing = await self._user_repo.find_by_email(cmd.email)
        if existing is not None:
            raise ValidationError(f"Email '{cmd.email}' is already registered.")

        password_hash = hash_password(cmd.password)
        user = User.create(
            email=cmd.email,
            display_name=cmd.display_name,
            password_hash=password_hash,
        )
        await self._user_repo.add(user)

        provisioned = await self._onboarding.provision_tenant(cmd.org_name, user.id)

        raw_refresh = create_refresh_token_value()
        token_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
        refresh_entity = RefreshTokenEntity(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        await self._refresh_token_repo.add(refresh_entity)

        access_token = create_access_token(
            user_id=user.id,
            tenant_id=provisioned.tenant_id,
            roles=provisioned.roles,
        )

        return TokenPairDTO(access_token=access_token, refresh_token=raw_refresh)
