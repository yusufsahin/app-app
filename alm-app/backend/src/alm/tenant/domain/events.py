from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from alm.shared.domain.events import DomainEvent


@dataclass(frozen=True, kw_only=True)
class TenantCreated(DomainEvent):
    tenant_id: uuid.UUID
    name: str
    slug: str


@dataclass(frozen=True, kw_only=True)
class MemberInvited(DomainEvent):
    tenant_id: uuid.UUID
    email: str
    invited_by: uuid.UUID
    role_ids: list[uuid.UUID] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class MemberJoined(DomainEvent):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    membership_id: uuid.UUID


@dataclass(frozen=True, kw_only=True)
class MemberRemoved(DomainEvent):
    tenant_id: uuid.UUID
    user_id: uuid.UUID


@dataclass(frozen=True, kw_only=True)
class RoleAssigned(DomainEvent):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role_id: uuid.UUID
    assigned_by: uuid.UUID


@dataclass(frozen=True, kw_only=True)
class RoleRevoked(DomainEvent):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role_id: uuid.UUID


@dataclass(frozen=True, kw_only=True)
class RoleCreated(DomainEvent):
    tenant_id: uuid.UUID
    role_id: uuid.UUID
    role_name: str


@dataclass(frozen=True, kw_only=True)
class RoleUpdated(DomainEvent):
    tenant_id: uuid.UUID
    role_id: uuid.UUID


@dataclass(frozen=True, kw_only=True)
class RoleDeleted(DomainEvent):
    tenant_id: uuid.UUID
    role_id: uuid.UUID


@dataclass(frozen=True, kw_only=True)
class RolePrivilegesChanged(DomainEvent):
    tenant_id: uuid.UUID
    role_id: uuid.UUID
    privilege_ids: list[uuid.UUID] = field(default_factory=list)
