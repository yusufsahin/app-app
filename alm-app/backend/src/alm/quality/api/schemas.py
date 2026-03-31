"""Pydantic schemas for Quality API routes."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class LastExecutionStatusRequest(BaseModel):
    test_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=200)
    scope_run_id: uuid.UUID | None = None
    scope_suite_id: uuid.UUID | None = None
    scope_campaign_id: uuid.UUID | None = None
    scope_configuration_id: str | None = None

    @model_validator(mode="after")
    def _one_scope(self) -> LastExecutionStatusRequest:
        n = sum(
            1
            for x in (self.scope_run_id, self.scope_suite_id, self.scope_campaign_id)
            if x is not None
        )
        if n > 1:
            raise ValueError("At most one of scope_run_id, scope_suite_id, scope_campaign_id")
        return self


class LastExecutionStepStatusItem(BaseModel):
    step_id: str
    status: str
    linked_defect_ids: list[str] = Field(default_factory=list)
    attachment_ids: list[str] = Field(default_factory=list)


class LastExecutionStatusItem(BaseModel):
    test_id: uuid.UUID
    status: str | None = None
    run_id: uuid.UUID | None = None
    run_title: str | None = None
    run_updated_at: datetime | None = None
    configuration_id: str | None = None
    configuration_name: str | None = None
    param_row_index: int | None = None
    step_results: list[LastExecutionStepStatusItem] = Field(default_factory=list)


class LastExecutionStatusResponse(BaseModel):
    items: list[LastExecutionStatusItem]


class ResolveExecutionConfigRequest(BaseModel):
    run_id: uuid.UUID
    test_id: uuid.UUID
    configuration_id: str | None = None


class ResolveExecutionConfigOptionItem(BaseModel):
    id: str
    name: str | None = None
    is_default: bool = False


class ResolveExecutionConfigStepItem(BaseModel):
    id: str
    step_number: int
    name: str
    description: str
    expected_result: str
    status: str


class ResolveExecutionConfigResponse(BaseModel):
    test_id: uuid.UUID
    configuration_id: str | None = None
    configuration_name: str | None = None
    available_configurations: list[ResolveExecutionConfigOptionItem] = Field(default_factory=list)
    resolved_values: dict[str, str] = Field(default_factory=dict)
    unresolved_params: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    steps: list[ResolveExecutionConfigStepItem] = Field(default_factory=list)


class RequirementCoverageTestRefResponse(BaseModel):
    test_id: uuid.UUID
    status: str | None = None
    run_id: uuid.UUID | None = None
    run_title: str | None = None


class RequirementCoverageLeafResponse(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None = None
    title: str
    artifact_key: str | None = None
    leaf_status: str
    verifying_test_ids: list[uuid.UUID] = Field(default_factory=list)
    tests: list[RequirementCoverageTestRefResponse] = Field(default_factory=list)


class RequirementCoverageNodeResponse(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None = None
    title: str
    artifact_key: str | None = None
    artifact_type: str
    direct_status: str
    subtree_counts: dict[str, int]


class RequirementCoverageAnalysisResponse(BaseModel):
    computed_at: datetime
    cache_hit: bool
    nodes: list[RequirementCoverageNodeResponse]
    leaves: list[RequirementCoverageLeafResponse]


class TraceabilityMatrixColumnResponse(BaseModel):
    test_id: uuid.UUID
    artifact_key: str | None = None
    title: str


class TraceabilityMatrixCellResponse(BaseModel):
    test_id: uuid.UUID
    linked: bool = True
    status: str | None = None
    run_id: uuid.UUID | None = None
    run_title: str | None = None


class TraceabilityMatrixRowResponse(BaseModel):
    requirement_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    artifact_key: str | None = None
    title: str
    cells: list[TraceabilityMatrixCellResponse] = Field(default_factory=list)


class TraceabilityRelationshipResponse(BaseModel):
    requirement_id: uuid.UUID
    requirement_parent_id: uuid.UUID | None = None
    requirement_artifact_key: str | None = None
    requirement_title: str
    test_id: uuid.UUID
    test_artifact_key: str | None = None
    test_title: str
    link_type: str
    status: str | None = None
    run_id: uuid.UUID | None = None
    run_title: str | None = None


class RequirementTraceabilityMatrixResponse(BaseModel):
    computed_at: datetime
    cache_hit: bool
    truncated: bool = False
    rows: list[TraceabilityMatrixRowResponse] = Field(default_factory=list)
    columns: list[TraceabilityMatrixColumnResponse] = Field(default_factory=list)
    relationships: list[TraceabilityRelationshipResponse] = Field(default_factory=list)
