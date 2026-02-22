from __future__ import annotations

import uuid
from datetime import UTC, datetime

from alm.shared.domain.aggregate import AggregateRoot
from alm.shared.domain.entity import BaseEntity
from alm.shared.domain.exceptions import ValidationError
from alm.tenant.domain.events import (
    RoleCreated,
    RolePrivilegesChanged,
    RoleUpdated,
    TenantCreated,
)


class Tenant(AggregateRoot):
    def __init__(
        self,
        name: str,
        slug: str,
        *,
        id: uuid.UUID | None = None,
        tier: str = "free",
        settings: dict | None = None,
    ) -> None:
        super().__init__(id=id)
        self.name = name
        self.slug = slug
        self.tier = tier
        self.settings = settings or {}

    @classmethod
    def create(cls, name: str, slug: str) -> Tenant:
        tenant = cls(name=name, slug=slug)
        tenant._register_event(TenantCreated(tenant_id=tenant.id, name=name, slug=slug))
        return tenant

    def update_settings(self, name: str | None = None, settings: dict | None = None) -> None:
        if name is not None:
            self.name = name
        if settings is not None:
            self.settings = settings
        self.touch()


class TenantMembership(BaseEntity):
    def __init__(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        *,
        id: uuid.UUID | None = None,
        invited_by: uuid.UUID | None = None,
    ) -> None:
        super().__init__(id=id)
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.invited_by = invited_by
        self.joined_at = datetime.now(UTC)


class Role(AggregateRoot):
    def __init__(
        self,
        tenant_id: uuid.UUID,
        name: str,
        slug: str,
        *,
        id: uuid.UUID | None = None,
        description: str = "",
        is_system: bool = False,
        hierarchy_level: int = 100,
    ) -> None:
        super().__init__(id=id)
        self.tenant_id = tenant_id
        self.name = name
        self.slug = slug
        self.description = description
        self.is_system = is_system
        self.hierarchy_level = hierarchy_level
        self.privilege_ids: list[uuid.UUID] = []

    @classmethod
    def create_system(
        cls,
        tenant_id: uuid.UUID,
        name: str,
        slug: str,
        hierarchy_level: int,
        description: str = "",
    ) -> Role:
        return cls(
            tenant_id=tenant_id,
            name=name,
            slug=slug,
            description=description,
            is_system=True,
            hierarchy_level=hierarchy_level,
        )

    @classmethod
    def create_custom(
        cls,
        tenant_id: uuid.UUID,
        name: str,
        slug: str,
        hierarchy_level: int,
        description: str = "",
    ) -> Role:
        role = cls(
            tenant_id=tenant_id,
            name=name,
            slug=slug,
            description=description,
            is_system=False,
            hierarchy_level=hierarchy_level,
        )
        role._register_event(RoleCreated(tenant_id=tenant_id, role_id=role.id, role_name=name))
        return role

    def validate_can_delete(self) -> None:
        if self.is_system:
            raise ValidationError("Cannot delete a system role")

    def update_info(
        self,
        name: str | None,
        description: str | None,
        hierarchy_level: int | None,
    ) -> None:
        if name is not None:
            if self.is_system:
                raise ValidationError("Cannot rename a system role")
            self.name = name
        if description is not None:
            self.description = description
        if hierarchy_level is not None:
            self.hierarchy_level = hierarchy_level
        self.touch()
        self._register_event(RoleUpdated(tenant_id=self.tenant_id, role_id=self.id))

    def set_privileges(self, privilege_ids: list[uuid.UUID]) -> None:
        self.privilege_ids = list(privilege_ids)
        self.touch()
        self._register_event(RolePrivilegesChanged(
            tenant_id=self.tenant_id,
            role_id=self.id,
            privilege_ids=list(privilege_ids),
        ))


class Privilege:
    """Application-wide privilege definition. Immutable after seed."""

    def __init__(
        self,
        code: str,
        resource: str,
        action: str,
        *,
        id: uuid.UUID | None = None,
        description: str = "",
    ) -> None:
        self.id = id or uuid.uuid4()
        self.code = code
        self.resource = resource
        self.action = action
        self.description = description

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Privilege):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)


class Invitation(AggregateRoot):
    def __init__(
        self,
        tenant_id: uuid.UUID,
        email: str,
        invited_by: uuid.UUID,
        token: str,
        expires_at: datetime,
        *,
        id: uuid.UUID | None = None,
        role_ids: list[uuid.UUID] | None = None,
    ) -> None:
        super().__init__(id=id)
        self.tenant_id = tenant_id
        self.email = email
        self.invited_by = invited_by
        self.token = token
        self.expires_at = expires_at
        self.accepted_at: datetime | None = None
        self.role_ids: list[uuid.UUID] = role_ids or []

    @property
    def is_expired(self) -> bool:
        return datetime.now(UTC) >= self.expires_at

    @property
    def is_accepted(self) -> bool:
        return self.accepted_at is not None

    @property
    def is_valid(self) -> bool:
        return not self.is_expired and not self.is_accepted

    def accept(self) -> None:
        """Accept the invitation with full validation."""
        if self.is_expired:
            raise ValidationError("Invitation has expired")
        if self.is_accepted:
            raise ValidationError("Invitation already accepted")
        self.accepted_at = datetime.now(UTC)
