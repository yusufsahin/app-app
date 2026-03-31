"""API schemas for project work-item tags."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectTagResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectTagCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class ProjectTagRenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
