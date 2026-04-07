"""S4b: mark linked test artifacts stale when upstream planning items change."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import func, select, update

from alm.artifact.application.stale_traceability_policy import (
    LINKED_QUALITY_TYPES,
    STALE_REASON_CODE,
    TEST_TO_UPSTREAM_REL_TYPES,
    UPSTREAM_PLANNING_TYPES,
    UPSTREAM_TO_TEST_REL_TYPES,
)
from alm.artifact.domain.events import ArtifactStateChanged, ArtifactUpdated
from alm.artifact.infrastructure.models import ArtifactModel
from alm.relationship.infrastructure.models import RelationshipModel
from alm.shared.domain.events import DomainEvent
from alm.shared.infrastructure.db.session import async_session_factory

logger = structlog.get_logger()


def _norm_type(value: str | None) -> str:
    return (value or "").strip().lower()


async def _mark_linked_quality_stale(
    session,
    *,
    project_id: uuid.UUID,
    upstream_artifact_id: uuid.UUID,
) -> None:
    res = await session.execute(
        select(ArtifactModel.artifact_type).where(
            ArtifactModel.id == upstream_artifact_id,
            ArtifactModel.project_id == project_id,
            ArtifactModel.deleted_at.is_(None),
        )
    )
    upstream_type = res.scalar_one_or_none()
    if upstream_type is None or _norm_type(upstream_type) not in UPSTREAM_PLANNING_TYPES:
        return

    r1 = await session.execute(
        select(RelationshipModel.source_artifact_id).where(
            RelationshipModel.project_id == project_id,
            RelationshipModel.target_artifact_id == upstream_artifact_id,
            func.lower(RelationshipModel.relationship_type).in_(tuple(TEST_TO_UPSTREAM_REL_TYPES)),
        )
    )
    r2 = await session.execute(
        select(RelationshipModel.target_artifact_id).where(
            RelationshipModel.project_id == project_id,
            RelationshipModel.source_artifact_id == upstream_artifact_id,
            func.lower(RelationshipModel.relationship_type).in_(tuple(UPSTREAM_TO_TEST_REL_TYPES)),
        )
    )
    candidates: set[uuid.UUID] = set(r1.scalars().all()) | set(r2.scalars().all())
    if not candidates:
        return

    r3 = await session.execute(
        select(ArtifactModel.id).where(
            ArtifactModel.project_id == project_id,
            ArtifactModel.id.in_(candidates),
            ArtifactModel.deleted_at.is_(None),
            func.lower(ArtifactModel.artifact_type).in_(tuple(LINKED_QUALITY_TYPES)),
        )
    )
    ids = [row for row in r3.scalars().all()]
    if not ids:
        return

    now = datetime.now(UTC)
    await session.execute(
        update(ArtifactModel)
        .where(ArtifactModel.id.in_(ids))
        .values(
            stale_traceability=True,
            stale_traceability_reason=STALE_REASON_CODE,
            stale_traceability_at=now,
        )
    )


async def on_upstream_planning_changed_mark_linked_tests_stale(event: DomainEvent) -> None:
    if isinstance(event, ArtifactStateChanged):
        aid, pid = event.artifact_id, event.project_id
    elif isinstance(event, ArtifactUpdated):
        aid, pid = event.artifact_id, event.project_id
    else:
        return

    try:
        async with async_session_factory() as session:
            try:
                await _mark_linked_quality_stale(session, project_id=pid, upstream_artifact_id=aid)
                await session.commit()
            except Exception:
                await session.rollback()
                raise
    except Exception:
        logger.exception(
            "stale_traceability_handler_failed",
            artifact_id=str(aid),
            project_id=str(pid),
            event_type=type(event).__name__,
        )
