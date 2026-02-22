from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.domain.events import DomainEvent


@dataclass(frozen=True, kw_only=True)
class UserRegistered(DomainEvent):
    user_id: uuid.UUID
    email: str


@dataclass(frozen=True, kw_only=True)
class UserLoggedIn(DomainEvent):
    user_id: uuid.UUID
    tenant_id: uuid.UUID | None = None


@dataclass(frozen=True, kw_only=True)
class PasswordChanged(DomainEvent):
    user_id: uuid.UUID
