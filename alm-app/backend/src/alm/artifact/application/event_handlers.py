"""Artifact domain event handlers — DDD Enterprise Clean Architecture.

Example: ArtifactCreated handler for side effects (notification, analytics, etc.).
"""
from __future__ import annotations

import structlog

from alm.artifact.domain.events import ArtifactCreated, ArtifactStateChanged
from alm.shared.domain.events import DomainEvent

logger = structlog.get_logger()


async def on_artifact_created(event: DomainEvent) -> None:
    """Handle ArtifactCreated: log, analytics, or trigger integration."""
    if not isinstance(event, ArtifactCreated):
        return
    logger.info(
        "artifact_created_handler",
        artifact_id=str(event.artifact_id),
        project_id=str(event.project_id),
        artifact_type=event.artifact_type,
    )


async def on_artifact_state_changed(event: DomainEvent) -> None:
    """Handle ArtifactStateChanged: log transition, update metrics."""
    if not isinstance(event, ArtifactStateChanged):
        return
    logger.info(
        "artifact_state_changed_handler",
        artifact_id=str(event.artifact_id),
        from_state=event.from_state,
        to_state=event.to_state,
    )
