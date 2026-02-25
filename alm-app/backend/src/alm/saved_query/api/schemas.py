"""SavedQuery API schemas."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class SavedQueryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    filter_params: dict = Field(default_factory=dict)
    visibility: str = Field(default="private", pattern="^(private|project)$")


class SavedQueryUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    filter_params: dict | None = None
    visibility: str | None = Field(None, pattern="^(private|project)$")


class SavedQueryResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    visibility: str
    filter_params: dict
    created_at: str | None
    updated_at: str | None
