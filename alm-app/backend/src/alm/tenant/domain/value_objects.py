from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class TenantTier:
    value: str

    def __post_init__(self) -> None:
        if self.value not in ("free", "pro", "enterprise"):
            raise ValueError(f"Invalid tenant tier: {self.value}")


@dataclass(frozen=True)
class InviteToken:
    value: str


@dataclass(frozen=True)
class PrivilegeCode:
    """Format: 'resource:action' e.g. 'artifact:read'."""

    value: str

    def __post_init__(self) -> None:
        if self.value != "*" and not re.match(r"^[a-z_]+:[a-z_*]+$", self.value):
            raise ValueError(f"Invalid privilege code: {self.value}")

    @property
    def resource(self) -> str:
        if self.value == "*":
            return "*"
        return self.value.split(":")[0]

    @property
    def action(self) -> str:
        if self.value == "*":
            return "*"
        return self.value.split(":")[1]

    def matches(self, other: PrivilegeCode) -> bool:
        """Check if this privilege grants access for the other privilege."""
        if self.value == "*":
            return True
        if self.resource == other.resource and self.action == "*":
            return True
        return self.value == other.value


@dataclass(frozen=True)
class RoleSlug:
    value: str

    def __post_init__(self) -> None:
        if not re.match(r"^[a-z0-9]+(?:_[a-z0-9]+)*$", self.value):
            raise ValueError(f"Invalid role slug: {self.value}")
