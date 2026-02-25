from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import EntityNotFound, ValidationError
from alm.shared.domain.ports import IPasswordHasher

if TYPE_CHECKING:
    import uuid

    from alm.auth.domain.ports import RefreshTokenRepository, UserRepository


@dataclass(frozen=True)
class ChangePassword(Command):
    user_id: uuid.UUID
    current_password: str
    new_password: str


class ChangePasswordHandler(CommandHandler[None]):
    def __init__(
        self,
        user_repo: UserRepository,
        refresh_token_repo: RefreshTokenRepository,
        password_hasher: IPasswordHasher,
    ) -> None:
        self._user_repo = user_repo
        self._refresh_token_repo = refresh_token_repo
        self._password_hasher = password_hasher

    async def handle(self, command: Command) -> None:
        cmd = cast("ChangePassword", command)

        user = await self._user_repo.find_by_id(cmd.user_id)
        if user is None:
            raise EntityNotFound("User", cmd.user_id)

        if not self._password_hasher.verify(cmd.current_password, user.password_hash):
            raise ValidationError("Current password is incorrect.")

        new_hash = self._password_hasher.hash(cmd.new_password)
        user.change_password(new_hash)
        await self._user_repo.update(user)

        await self._refresh_token_repo.revoke_all_for_user(cmd.user_id)
