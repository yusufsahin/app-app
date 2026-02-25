"""Artifact SQLAlchemy model."""
from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, SoftDeleteMixin, TimestampMixin


class ArtifactModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "artifacts"
    __table_args__ = (
        UniqueConstraint("project_id", "artifact_key", name="uq_artifact_project_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    artifact_key: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    artifact_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    state: Mapped[str] = mapped_column(String(50), nullable=False)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("artifacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    custom_fields: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, server_default="{}"
    )
    state_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rank_order: Mapped[float | None] = mapped_column(Float, nullable=True)
    cycle_node_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("cycle_nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    area_node_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("area_nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    area_path_snapshot: Mapped[str | None] = mapped_column(String(512), nullable=True)
