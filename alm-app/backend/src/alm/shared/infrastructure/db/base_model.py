from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, default=None)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, default=None)


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None, index=True
    )
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, default=None)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self, by: uuid.UUID) -> None:
        self.deleted_at = datetime.now(UTC)
        self.deleted_by = by

    def restore(self) -> None:
        self.deleted_at = None
        self.deleted_by = None


class TenantMixin:
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)


class BaseModel(Base, TimestampMixin, SoftDeleteMixin, TenantMixin):
    """Base for all tenant-scoped, soft-deletable models."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
