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
    sort_order: int | None = None


class ArtifactLinkReorderRequest(BaseModel):
    link_type: str = Field(min_length=1, max_length=100)
    ordered_link_ids: list[uuid.UUID] = Field(default_factory=list, max_length=500)


class ArtifactLinkBulkCreateRequest(BaseModel):
    to_artifact_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)
    link_type: str = Field(default="related", min_length=1, max_length=100)
    idempotency_key: str | None = Field(default=None, max_length=200)


class ArtifactLinkBulkDeleteRequest(BaseModel):
    link_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)
    idempotency_key: str | None = Field(default=None, max_length=200)


class ArtifactLinkBulkResultItem(BaseModel):
    id: uuid.UUID
    reason: str


class ArtifactLinkBulkResultResponse(BaseModel):
    succeeded: list[uuid.UUID]
    failed: list[ArtifactLinkBulkResultItem]
