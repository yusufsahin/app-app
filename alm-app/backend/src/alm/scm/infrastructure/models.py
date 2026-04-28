"""SCM link SQLAlchemy model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from alm.shared.infrastructure.db.base_model import Base, TimestampMixin


class ScmLinkModel(Base, TimestampMixin):
    __tablename__ = "scm_links"
    __table_args__ = (
        UniqueConstraint("artifact_id", "web_url", name="uq_scm_links_artifact_web_url"),
        Index(
            "uq_scm_links_artifact_commit_sha",
            "artifact_id",
            "commit_sha",
            unique=True,
            postgresql_where=sa.text("commit_sha IS NOT NULL"),
        ),
        Index(
            "uq_scm_links_artifact_repo_pr",
            "artifact_id",
            "repo_full_name",
            "pull_request_number",
            unique=True,
            postgresql_where=sa.text("pull_request_number IS NOT NULL"),
        ),
    )

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
    task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    repo_full_name: Mapped[str] = mapped_column(String(512), nullable=False)
    ref: Mapped[str] = mapped_column(String(255), nullable=True)
    commit_sha: Mapped[str] = mapped_column(String(64), nullable=True)
    pull_request_number: Mapped[int] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=True)
    web_url: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, server_default="manual")
    key_match_source: Mapped[str] = mapped_column(String(16), nullable=True)


class ScmWebhookProcessedDeliveryModel(Base):
    """Provider-issued delivery UUID (GitHub X-GitHub-Delivery, GitLab X-Gitlab-Event-UUID)."""

    __tablename__ = "scm_webhook_processed_deliveries"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "provider",
            "delivery_id",
            name="uq_scm_webhook_processed_deliveries_proj_provider_delivery",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    delivery_id: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ScmWebhookUnmatchedEventModel(Base):
    """Webhook delivery that could not be mapped to an artifact (triage queue)."""

    __tablename__ = "scm_webhook_unmatched_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    dismissed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    dismissed_by: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
