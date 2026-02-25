"""Task API schemas."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = ""
    state: str = "todo"
    assignee_id: uuid.UUID | None = None
    rank_order: float | None = None


class TaskUpdateRequest(BaseModel):
    title: str | None = Field(None, max_length=500)
    state: str | None = None
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    rank_order: float | None = None


class TaskResponse(BaseModel):
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
