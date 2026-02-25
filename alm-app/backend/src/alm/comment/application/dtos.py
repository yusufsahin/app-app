"""Comment DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class CommentDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    body: str
    created_by: uuid.UUID | None
    created_at: str | None
    updated_at: str | None
