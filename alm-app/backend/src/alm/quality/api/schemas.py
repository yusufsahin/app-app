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


class LastExecutionStatusItem(BaseModel):
    test_id: uuid.UUID
    status: str | None = None
    run_id: uuid.UUID | None = None
    run_title: str | None = None
    run_updated_at: datetime | None = None
    param_row_index: int | None = None
    step_results: list[LastExecutionStepStatusItem] = Field(default_factory=list)


class LastExecutionStatusResponse(BaseModel):
    items: list[LastExecutionStatusItem]


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
