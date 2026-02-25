"""Comment API schemas."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class CommentCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class CommentResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    body: str
    created_by: uuid.UUID | None
    created_at: str | None
    updated_at: str | None
