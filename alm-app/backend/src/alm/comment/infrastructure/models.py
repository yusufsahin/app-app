"""Comment SQLAlchemy model."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, TimestampMixin


class CommentModel(Base, TimestampMixin):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    artifact_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("artifacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
