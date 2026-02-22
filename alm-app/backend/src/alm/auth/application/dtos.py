from __future__ import annotations

import uuid
from dataclasses import dataclass, field


@dataclass(frozen=True)
class TokenPairDTO:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@dataclass(frozen=True)
class TenantInfoDTO:
    tenant_id: str
    tenant_name: str
    tenant_slug: str
    roles: list[str]


@dataclass(frozen=True)
class LoginResultDTO:
    """Single-tenant login returns token_pair; multi-tenant returns tenants + temp_token."""

    token_pair: TokenPairDTO | None = None
    requires_tenant_selection: bool = False
    tenants: list[TenantInfoDTO] = field(default_factory=list)
    temp_token: str | None = None


@dataclass(frozen=True)
class CurrentUserDTO:
    id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    roles: list[str] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
