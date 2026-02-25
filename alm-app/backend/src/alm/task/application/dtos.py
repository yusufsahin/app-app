"""Task DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class TaskDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    title: str
    state: str
    description: str
    assignee_id: uuid.UUID | None
    rank_order: float | None
    created_at: str | None
    updated_at: str | None
