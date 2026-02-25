"""Artifact DTOs."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ArtifactDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_type: str
    title: str
    description: str
    state: str
    assignee_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    custom_fields: dict
    artifact_key: str | None = None
    state_reason: str | None = None
    resolution: str | None = None
    rank_order: float | None = None
    cycle_node_id: uuid.UUID | None = None
    area_node_id: uuid.UUID | None = None
    area_path_snapshot: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
