"""SQLAlchemy models for JaVers-inspired audit storage."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alm.shared.infrastructure.db.base_model import Base


class AuditCommitModel(Base):
    __tablename__ = "audit_commits"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    committed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    properties: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class AuditSnapshotModel(Base):
    __tablename__ = "audit_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    commit_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("audit_commits.id"), nullable=False, index=True
    )
    global_id: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    change_type: Mapped[str] = mapped_column(String(16), nullable=False)
    state: Mapped[dict] = mapped_column(JSON, nullable=False)
    changed_properties: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    commit: Mapped[AuditCommitModel] = relationship(
        AuditCommitModel, lazy="joined"
    )

    __table_args__ = (
        Index("ix_snapshot_entity_version", "entity_type", "entity_id", "version"),
    )
