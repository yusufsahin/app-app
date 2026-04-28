"""Artifact SQLAlchemy model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, SoftDeleteMixin, TimestampMixin


class ArtifactModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "artifacts"
    __table_args__ = (UniqueConstraint("project_id", "artifact_key", name="uq_artifact_project_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    artifact_key: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    artifact_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    state: Mapped[str] = mapped_column(String(50), nullable=False)
    assignee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    parent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("artifacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    custom_fields: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=True, server_default="{}")
    state_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    resolution: Mapped[str] = mapped_column(String(100), nullable=True)
    rank_order: Mapped[float] = mapped_column(Float, nullable=True)
    cycle_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("cycle_nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    area_node_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("area_nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    area_path_snapshot: Mapped[str] = mapped_column(String(512), nullable=True)
    team_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    stale_traceability: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    stale_traceability_reason: Mapped[str] = mapped_column(String(512), nullable=True)
    stale_traceability_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
