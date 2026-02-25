"""ArtifactLink SQLAlchemy model."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, TimestampMixin


class ArtifactLinkModel(Base, TimestampMixin):
    __tablename__ = "artifact_links"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_artifact_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    to_artifact_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    link_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
