"""Artifact DTOs."""
from __future__ import annotations

import uuid
from dataclasses import dataclass


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
