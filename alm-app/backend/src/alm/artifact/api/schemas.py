"""Artifact API schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Self

from pydantic import BaseModel, Field, field_validator, model_validator

from alm.artifact.api.quality_test_params import validate_and_normalize_test_params_json
from alm.artifact.application.dtos import ArtifactDTO


class ProjectTagBrief(BaseModel):
    """Project work-item tag (id + display name), ADO-style."""

    id: uuid.UUID
    name: str


def _normalize_test_params_in_custom_fields(cf: dict[str, Any]) -> None:
    if "test_params_json" not in cf:
        return
    raw = cf["test_params_json"]
    if raw is None:
        return
    normalized = validate_and_normalize_test_params_json(raw)
    if normalized is None:
        del cf["test_params_json"]
    else:
        cf["test_params_json"] = normalized


class ArtifactCreateRequest(BaseModel):
    artifact_type: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=500)
    description: str = ""
    parent_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    artifact_key: str | None = None
    rank_order: float | None = None
    cycle_node_id: uuid.UUID | None = None
    area_node_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    tag_ids: list[uuid.UUID] | None = None

    @field_validator("parent_id", "assignee_id", "cycle_node_id", "area_node_id", "team_id", mode="before")
    @classmethod
    def empty_str_to_none_uuid(cls, v: str | uuid.UUID | None) -> uuid.UUID | None:
        if v is None:
            return None
        if isinstance(v, uuid.UUID):
            return v
        s = (v or "").strip()
        if not s:
            return None
        return uuid.UUID(s)

    @model_validator(mode="after")
    def normalize_test_params(self) -> Self:
        _normalize_test_params_in_custom_fields(self.custom_fields)
        return self


class ArtifactResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    artifact_type: str
    title: str
    description: str
    state: str
    assignee_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    artifact_key: str | None = None
    state_reason: str | None = None
    resolution: str | None = None
    rank_order: float | None = None
    cycle_node_id: uuid.UUID | None = None
    area_node_id: uuid.UUID | None = None
    area_path_snapshot: str | None = None
    team_id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    tags: list[ProjectTagBrief] = Field(default_factory=list)
    # Permission-aware UI: actions the current user can perform on this artifact
    allowed_actions: list[str] = Field(default_factory=list)


class ArtifactListResponse(BaseModel):
    items: list[ArtifactResponse]
    total: int
    # Permission-aware UI: same as per-item when list non-empty; set when empty for e.g. "New artifact" button
    allowed_actions: list[str] = Field(default_factory=list)


class ArtifactUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    cycle_node_id: uuid.UUID | None = None
    area_node_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    custom_fields: dict[str, Any] | None = None
    tag_ids: list[uuid.UUID] | None = None

    @field_validator("assignee_id", "cycle_node_id", "area_node_id", "team_id", "parent_id", mode="before")
    @classmethod
    def empty_str_to_none_uuid(cls, v: str | uuid.UUID | None) -> uuid.UUID | None:
        if v is None:
            return None
        if isinstance(v, uuid.UUID):
            return v
        s = (v or "").strip()
        if not s:
            return None
        return uuid.UUID(s)

    @model_validator(mode="after")
    def normalize_test_params(self) -> Self:
        if self.custom_fields is not None:
            _normalize_test_params_in_custom_fields(self.custom_fields)
        return self


class PermittedTransitionItem(BaseModel):
    trigger: str
    to_state: str
    label: str | None = None


class PermittedTransitionsResponse(BaseModel):
    items: list[PermittedTransitionItem]


class ArtifactTransitionRequest(BaseModel):
    new_state: str | None = Field(default=None, min_length=1)
    trigger: str | None = Field(
        default=None, description="If set, transition by trigger (to_state derived from workflow)"
    )
    state_reason: str | None = None
    resolution: str | None = None
    expected_updated_at: str | None = None  # ISO datetime for optimistic lock; omit to skip check (e.g. overwrite)

    @model_validator(mode="after")
    def require_new_state_or_trigger(self) -> ArtifactTransitionRequest:
        if not (self.new_state or self.trigger):
            raise ValueError("Either new_state or trigger must be set")
        return self


class BatchTransitionRequest(BaseModel):
    artifact_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)
    new_state: str | None = Field(default=None, min_length=1)
    trigger: str | None = Field(
        default=None, description="If set, apply this trigger to each artifact (to_state derived per workflow)"
    )
    state_reason: str | None = None
    resolution: str | None = None

    @model_validator(mode="after")
    def require_new_state_or_trigger(self) -> BatchTransitionRequest:
        if not (self.new_state or self.trigger):
            raise ValueError("Either new_state or trigger must be set")
        return self


class BatchDeleteRequest(BaseModel):
    artifact_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


class BatchResultResponse(BaseModel):
    success_count: int
    error_count: int
    errors: list[str] = Field(default_factory=list)
    results: dict[str, str] | None = Field(
        default=None,
        description=(
            "Per-artifact result: artifact_id -> "
            "'ok' | 'validation_error' | 'guard_denied' | 'policy_denied' | 'conflict_error'"
        ),
    )


def artifact_response_from_dto(d: ArtifactDTO) -> ArtifactResponse:
    """Map application DTO to API response (tags + core fields; allowed_actions filled by masking)."""
    if not isinstance(d, ArtifactDTO):
        raise TypeError("artifact_response_from_dto expects ArtifactDTO")
    return ArtifactResponse(
        id=d.id,
        project_id=d.project_id,
        artifact_type=d.artifact_type,
        title=d.title,
        description=d.description,
        state=d.state,
        assignee_id=d.assignee_id,
        parent_id=d.parent_id,
        custom_fields=d.custom_fields,
        artifact_key=d.artifact_key,
        state_reason=d.state_reason,
        resolution=d.resolution,
        rank_order=d.rank_order,
        cycle_node_id=d.cycle_node_id,
        area_node_id=d.area_node_id,
        area_path_snapshot=d.area_path_snapshot,
        team_id=d.team_id,
        created_at=d.created_at,
        updated_at=d.updated_at,
        tags=[ProjectTagBrief(id=t.id, name=t.name) for t in d.tags],
        allowed_actions=[],
    )
