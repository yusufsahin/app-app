"""Artifact API schemas."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class ArtifactCreateRequest(BaseModel):
    artifact_type: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=500)
    description: str = ""
    parent_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    custom_fields: dict = Field(default_factory=dict)


class ArtifactResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_type: str
    title: str
    description: str
    state: str
    assignee_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    custom_fields: dict = Field(default_factory=dict)


class ArtifactTransitionRequest(BaseModel):
    new_state: str = Field(min_length=1)
