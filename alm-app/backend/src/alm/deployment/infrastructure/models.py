"""Deployment event persistence (S4a)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base


class DeploymentEventModel(Base):
    __tablename__ = "deployment_events"
    __table_args__ = (
        Index("ix_deployment_events_project_env_occurred", "project_id", "environment", "occurred_at"),
        Index(
            "uq_deployment_events_project_idempotency_key",
            "project_id",
            "idempotency_key",
            unique=True,
            postgresql_where=sa.text("idempotency_key IS NOT NULL"),
        ),
        Index(
            "uq_deployment_events_project_env_build",
            "project_id",
            "environment",
            "build_id",
            unique=True,
            postgresql_where=sa.text("build_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    environment: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    commit_sha: Mapped[str] = mapped_column(String(64), nullable=True)
    image_digest: Mapped[str] = mapped_column(String(512), nullable=True)
    repo_full_name: Mapped[str] = mapped_column(String(512), nullable=True)
    artifact_keys: Mapped[list[str]] = mapped_column(ARRAY(String(128)), nullable=True)
    release_label: Mapped[str] = mapped_column(String(256), nullable=True)
    build_id: Mapped[str] = mapped_column(String(256), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    raw_context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
