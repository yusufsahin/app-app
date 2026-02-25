"""AreaNode SQLAlchemy model."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, TimestampMixin


class AreaNodeModel(Base, TimestampMixin):
    __tablename__ = "area_nodes"
    __table_args__ = (UniqueConstraint("project_id", "path", name="uq_area_nodes_project_path"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("area_nodes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    depth: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
