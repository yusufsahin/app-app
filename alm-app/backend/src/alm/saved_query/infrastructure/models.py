"""SavedQuery SQLAlchemy model."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, TimestampMixin


class SavedQueryModel(Base, TimestampMixin):
    __tablename__ = "saved_queries"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    visibility: Mapped[str] = mapped_column(String(50), nullable=False, server_default="private")
    filter_params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
