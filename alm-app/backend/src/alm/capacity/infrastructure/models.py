"""Capacity SQLAlchemy model."""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, Float, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, TimestampMixin


class CapacityModel(Base, TimestampMixin):
    __tablename__ = "capacities"
    __table_args__ = (
        CheckConstraint("capacity_value >= 0", name="ck_capacities_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cycle_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("cycle_nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    capacity_value: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    unit: Mapped[str] = mapped_column(String(32), nullable=False, server_default="hours")

