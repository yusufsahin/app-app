from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alm.shared.infrastructure.db.base_model import Base, SoftDeleteMixin, TimestampMixin


class TenantModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    tier: Mapped[str] = mapped_column(String(50), nullable=False, default="free")
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    memberships: Mapped[list[TenantMembershipModel]] = relationship(back_populates="tenant", lazy="selectin")
    roles: Mapped[list[RoleModel]] = relationship(back_populates="tenant", lazy="selectin")


class TenantMembershipModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tenant_memberships"
    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_membership_user_tenant"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tenants.id"), nullable=False, index=True)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped[TenantModel] = relationship(back_populates="memberships", lazy="joined")
    membership_roles: Mapped[list[MembershipRoleModel]] = relationship(
        back_populates="membership", lazy="selectin", cascade="all, delete-orphan"
    )


class RoleModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_role_tenant_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    hierarchy_level: Mapped[int] = mapped_column(Integer, nullable=False, default=100)

    tenant: Mapped[TenantModel] = relationship(back_populates="roles", lazy="joined")
    role_privileges: Mapped[list[RolePrivilegeModel]] = relationship(
        back_populates="role", lazy="selectin", cascade="all, delete-orphan"
    )


class PrivilegeModel(Base):
    __tablename__ = "privileges"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    resource: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")


class RolePrivilegeModel(Base):
    __tablename__ = "role_privileges"

    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    privilege_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("privileges.id", ondelete="CASCADE"), primary_key=True
    )

    role: Mapped[RoleModel] = relationship(back_populates="role_privileges", lazy="joined")
    privilege: Mapped[PrivilegeModel] = relationship(lazy="joined")


class MembershipRoleModel(Base):
    __tablename__ = "membership_roles"

    membership_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenant_memberships.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)

    membership: Mapped[TenantMembershipModel] = relationship(back_populates="membership_roles", lazy="joined")
    role: Mapped[RoleModel] = relationship(lazy="joined")


class InvitationModel(Base, TimestampMixin):
    __tablename__ = "invitations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tenants.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    invitation_roles: Mapped[list[InvitationRoleModel]] = relationship(
        back_populates="invitation", lazy="selectin", cascade="all, delete-orphan"
    )


class InvitationRoleModel(Base):
    __tablename__ = "invitation_roles"

    invitation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("invitations.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )

    invitation: Mapped[InvitationModel] = relationship(back_populates="invitation_roles", lazy="joined")
    role: Mapped[RoleModel] = relationship(lazy="joined")
