"""Task SQLAlchemy model."""

from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, SoftDeleteMixin, TimestampMixin


class TaskModel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tasks"

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
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    state: Mapped[str] = mapped_column(String(50), nullable=False, server_default="todo")
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    assignee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rank_order: Mapped[float] = mapped_column(Float, nullable=True)
    team_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    original_estimate_hours: Mapped[float] = mapped_column(Float, nullable=True)
    remaining_work_hours: Mapped[float] = mapped_column(Float, nullable=True)
    activity: Mapped[str] = mapped_column(String(64), nullable=True)
