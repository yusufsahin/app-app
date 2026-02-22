from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class TenantDTO:
    id: uuid.UUID
    name: str
    slug: str
    tier: str


@dataclass(frozen=True)
class TenantWithRolesDTO:
    id: uuid.UUID
    name: str
    slug: str
    tier: str
    roles: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class PrivilegeDTO:
    id: uuid.UUID
    code: str
    resource: str
    action: str
    description: str


@dataclass(frozen=True)
class RoleInfoDTO:
    id: uuid.UUID
    name: str
    slug: str
    is_system: bool
    hierarchy_level: int


@dataclass(frozen=True)
class RoleDetailDTO:
    id: uuid.UUID
    name: str
    slug: str
    description: str
    is_system: bool
    hierarchy_level: int
    privileges: list[PrivilegeDTO] = field(default_factory=list)


@dataclass(frozen=True)
class MemberDTO:
    user_id: uuid.UUID
    email: str
    display_name: str
    roles: list[RoleInfoDTO] = field(default_factory=list)
    joined_at: datetime | None = None


@dataclass(frozen=True)
class InvitationDTO:
    id: uuid.UUID
    email: str
    roles: list[RoleInfoDTO] = field(default_factory=list)
    expires_at: datetime | None = None
    accepted_at: datetime | None = None


@dataclass(frozen=True)
class MembershipDTO:
    id: uuid.UUID
    user_id: uuid.UUID
    tenant_id: uuid.UUID
