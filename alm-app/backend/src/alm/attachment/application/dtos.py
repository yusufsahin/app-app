"""Attachment DTOs."""
from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class AttachmentDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    file_name: str
    content_type: str
    size: int
    storage_key: str
    created_by: uuid.UUID | None
    created_at: str | None
