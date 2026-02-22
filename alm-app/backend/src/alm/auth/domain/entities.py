from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from alm.auth.domain.events import PasswordChanged, UserRegistered
from alm.shared.domain.aggregate import AggregateRoot
from alm.shared.domain.entity import BaseEntity


class User(AggregateRoot):
    def __init__(
        self,
        email: str,
        display_name: str,
        password_hash: str,
        *,
        id: uuid.UUID | None = None,
        is_active: bool = True,
        email_verified: bool = False,
    ) -> None:
        super().__init__(id=id)
        self.email = email
        self.display_name = display_name
        self.password_hash = password_hash
        self.is_active = is_active
        self.email_verified = email_verified

    @classmethod
    def create(cls, email: str, display_name: str, password_hash: str) -> User:
        user = cls(email=email, display_name=display_name, password_hash=password_hash)
        user._register_event(UserRegistered(user_id=user.id, email=email))
        return user

    def change_password(self, new_password_hash: str) -> None:
        self.password_hash = new_password_hash
        self.touch()
        self._register_event(PasswordChanged(user_id=self.id))

    def update_profile(self, display_name: str) -> None:
        self.display_name = display_name
        self.touch()

    def deactivate(self) -> None:
        self.is_active = False
        self.touch()

    _audit_excluded_fields: frozenset[str] = frozenset({"password_hash"})

    def to_snapshot_dict(self) -> dict[str, Any]:
        data = super().to_snapshot_dict()
        for field in self._audit_excluded_fields:
            data.pop(field, None)
        return data


class RefreshToken(BaseEntity):
    def __init__(
        self,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
        *,
        id: uuid.UUID | None = None,
    ) -> None:
        super().__init__(id=id)
        self.user_id = user_id
        self.token_hash = token_hash
        self.expires_at = expires_at
        self.revoked_at: datetime | None = None

    @property
    def is_valid(self) -> bool:
        return self.revoked_at is None and datetime.now(UTC) < self.expires_at

    def revoke(self) -> None:
        self.revoked_at = datetime.now(UTC)
