"""ArtifactLink API schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class ArtifactLinkCreateRequest(BaseModel):
    to_artifact_id: uuid.UUID
    link_type: str = Field(default="related", min_length=1, max_length=100)


class ArtifactLinkResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    from_artifact_id: uuid.UUID
    to_artifact_id: uuid.UUID
    link_type: str
    created_at: str | None
