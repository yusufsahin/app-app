"""Auth application service: ensure user exists (for tenant admin flow). Implements IUserCreationPort."""

from __future__ import annotations

from alm.auth.domain.entities import User
from alm.auth.domain.ports import IUserCreationPort, UserCreationResult, UserRepository


class CreateUserService(IUserCreationPort):
    """Creates a user if email is new; returns existing user info if email already exists."""

    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    async def ensure_user(
        self,
        email: str,
        display_name: str,
        password_hash: str,
    ) -> UserCreationResult:
        existing = await self._user_repo.find_by_email(email)
        if existing is not None:
            return UserCreationResult(
                user_id=existing.id,
                email=existing.email,
                display_name=existing.display_name,
            )
        user = User.create(
            email=email,
            display_name=display_name,
            password_hash=password_hash,
        )
        user = await self._user_repo.add(user)
        return UserCreationResult(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
        )
