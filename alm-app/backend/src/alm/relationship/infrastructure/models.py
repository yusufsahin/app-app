"""Relationship SQLAlchemy model."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, TimestampMixin


class RelationshipModel(Base, TimestampMixin):
    __tablename__ = "relationships"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "source_artifact_id",
            "target_artifact_id",
            "relationship_type",
            name="uq_relationships_project_from_to_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_artifact_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_artifact_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sort_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
