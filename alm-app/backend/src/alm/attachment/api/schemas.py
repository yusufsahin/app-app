"""Attachment API schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    file_name: str
    content_type: str
    size: int
    created_by: uuid.UUID | None
    created_at: str | None
