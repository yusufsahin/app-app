"""Artifact domain events."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.domain.events import DomainEvent


@dataclass(frozen=True, kw_only=True)
class ArtifactCreated(DomainEvent):
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    artifact_type: str
    title: str
    state: str


@dataclass(frozen=True, kw_only=True)
class ArtifactStateChanged(DomainEvent):
    artifact_id: uuid.UUID
    project_id: uuid.UUID
    from_state: str
    to_state: str
