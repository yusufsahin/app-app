"""Relationship API schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from alm.artifact.api.schemas import ArtifactResponse


class ArtifactRelationshipCreateRequest(BaseModel):
    target_artifact_id: uuid.UUID
    relationship_type: str = Field(default="related", min_length=1, max_length=100)


class ArtifactRelationshipBulkCreateRequest(BaseModel):
    target_artifact_ids: list[uuid.UUID] = Field(default_factory=list)
    relationship_type: str = Field(default="related", min_length=1, max_length=100)
    idempotency_key: str | None = Field(default=None, max_length=200)


class ArtifactRelationshipBulkDeleteRequest(BaseModel):
    relationship_ids: list[uuid.UUID] = Field(default_factory=list)
    idempotency_key: str | None = Field(default=None, max_length=200)


class ArtifactRelationshipBulkResultItem(BaseModel):
    id: uuid.UUID
    reason: str


class ArtifactRelationshipBulkResultResponse(BaseModel):
    succeeded: list[uuid.UUID] = Field(default_factory=list)
    failed: list[ArtifactRelationshipBulkResultItem] = Field(default_factory=list)


class ArtifactRelationshipReorderRequest(BaseModel):
    relationship_type: str = Field(min_length=1, max_length=100)
    ordered_relationship_ids: list[uuid.UUID] = Field(default_factory=list)


class RelationshipTypeOptionResponse(BaseModel):
    key: str
    label: str
    reverse_label: str
    category: str
    directionality: str
    allowed_target_types: list[str] = Field(default_factory=list)
    description: str | None = None


class ArtifactRelationshipResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    source_artifact_id: uuid.UUID
    target_artifact_id: uuid.UUID
    other_artifact_id: uuid.UUID
    other_artifact_type: str | None = None
    other_artifact_key: str | None = None
    other_artifact_title: str
    relationship_type: str
    direction: str
    category: str
    display_label: str
    created_at: str | None
    sort_order: int | None = None


class ImpactHierarchyRefResponse(BaseModel):
    id: uuid.UUID
    artifact_key: str | None = None
    title: str
    artifact_type: str


class ArtifactImpactAnalysisNodeResponse(BaseModel):
    artifact_id: uuid.UUID
    artifact_key: str | None = None
    artifact_type: str
    title: str
    state: str
    parent_id: uuid.UUID | None = None
    relationship_id: uuid.UUID | None = None
    relationship_type: str | None = None
    relationship_label: str | None = None
    direction: str | None = None
    depth: int
    has_more: bool = False
    hierarchy_path: list[ImpactHierarchyRefResponse] = Field(default_factory=list)
    children: list["ArtifactImpactAnalysisNodeResponse"] = Field(default_factory=list)


class ArtifactImpactAnalysisResponse(BaseModel):
    focus_artifact: ArtifactResponse
    trace_from: list[ArtifactImpactAnalysisNodeResponse] = Field(default_factory=list)
    trace_to: list[ArtifactImpactAnalysisNodeResponse] = Field(default_factory=list)
    applied_relationship_types: list[str] = Field(default_factory=list)
    depth: int


ArtifactImpactAnalysisNodeResponse.model_rebuild()
