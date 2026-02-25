"""Process template SQLAlchemy models."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alm.shared.infrastructure.db.base_model import Base, TimestampMixin


class ProcessTemplateModel(Base, TimestampMixin):
    """Global catalog of process templates (Basic, Scrum, Kanban, etc.)."""

    __tablename__ = "process_templates"
    __table_args__ = (UniqueConstraint("slug", name="uq_process_template_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    configuration: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    versions: Mapped[list[ProcessTemplateVersionModel]] = relationship(
        "ProcessTemplateVersionModel",
        back_populates="template",
        order_by="ProcessTemplateVersionModel.version",
    )


class ProcessTemplateVersionModel(Base, TimestampMixin):
    """A version of a process template with manifest bundle."""

    __tablename__ = "process_template_versions"
    __table_args__ = (
        UniqueConstraint(
            "template_id",
            "version",
            name="uq_process_template_version",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("process_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    manifest_bundle: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    template: Mapped[ProcessTemplateModel] = relationship(
        "ProcessTemplateModel",
        back_populates="versions",
    )
