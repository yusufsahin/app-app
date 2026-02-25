"""Publish domain events to Redis for real-time WebSocket delivery."""

from __future__ import annotations

import uuid

from alm.artifact.domain.events import ArtifactStateChanged
from alm.project.infrastructure.repositories import SqlAlchemyProjectRepository
from alm.realtime.pubsub import publish_event
from alm.shared.domain.events import DomainEvent
from alm.shared.infrastructure.db.session import async_session_factory


async def on_artifact_state_changed_realtime(event: DomainEvent) -> None:
    """Publish ArtifactStateChanged to Redis so WebSocket clients can refresh."""
    if not isinstance(event, ArtifactStateChanged):
        return
    async with async_session_factory() as session:
        project_repo = SqlAlchemyProjectRepository(session)
        project = await project_repo.find_by_id(event.project_id)
        if project is None:
            return
        tenant_id: uuid.UUID = project.tenant_id
    await publish_event(
        tenant_id,
        {
            "type": "artifact_state_changed",
            "project_id": str(event.project_id),
            "artifact_id": str(event.artifact_id),
            "from_state": event.from_state,
            "to_state": event.to_state,
        },
    )
