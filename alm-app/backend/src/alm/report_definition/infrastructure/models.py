"""Report definition persistence (SQL / builtin / chart spec)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base


class ReportDefinitionModel(Base):
    __tablename__ = "report_definitions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    forked_from_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("report_definitions.id", ondelete="SET NULL"), nullable=True
    )
    catalog_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    visibility: Mapped[str] = mapped_column(String(32), nullable=False, server_default="project")
    query_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    builtin_report_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    builtin_parameters: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    sql_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    sql_bind_overrides: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    chart_spec: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    lifecycle_status: Mapped[str] = mapped_column(String(32), nullable=False, server_default="draft")
    last_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_validation_ok: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    last_validation_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
