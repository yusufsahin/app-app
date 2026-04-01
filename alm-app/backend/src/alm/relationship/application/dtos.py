"""Relationship application DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from alm.artifact.application.dtos import ArtifactDTO


@dataclass
class ArtifactRelationshipDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    source_artifact_id: uuid.UUID
    target_artifact_id: uuid.UUID
    relationship_type: str
    created_at: str | None
    sort_order: int | None = None


@dataclass
class ArtifactRelationshipViewDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    source_artifact_id: uuid.UUID
    target_artifact_id: uuid.UUID
    other_artifact_id: uuid.UUID
    other_artifact_type: str | None
    other_artifact_key: str | None
    other_artifact_title: str
    relationship_type: str
    direction: str
    category: str
    display_label: str
    created_at: str | None
    sort_order: int | None = None


@dataclass
class RelationshipTypeOptionDTO:
    key: str
    label: str
    reverse_label: str
    category: str
    directionality: str
    allowed_target_types: tuple[str, ...]
    description: str | None = None


@dataclass
class ImpactHierarchyRefDTO:
    id: uuid.UUID
    artifact_key: str | None
    title: str
    artifact_type: str


@dataclass
class ArtifactImpactAnalysisNodeDTO:
    artifact_id: uuid.UUID
    artifact_key: str | None
    artifact_type: str
    title: str
    state: str
    parent_id: uuid.UUID | None
    relationship_id: uuid.UUID | None
    relationship_type: str | None
    relationship_label: str | None
    direction: str | None
    depth: int
    has_more: bool = False
    hierarchy_path: tuple[ImpactHierarchyRefDTO, ...] = ()
    children: list["ArtifactImpactAnalysisNodeDTO"] = field(default_factory=list)


@dataclass
class ArtifactImpactAnalysisResultDTO:
    focus_artifact: ArtifactDTO
    trace_from: list[ArtifactImpactAnalysisNodeDTO]
    trace_to: list[ArtifactImpactAnalysisNodeDTO]
    applied_relationship_types: tuple[str, ...]
    depth: int
