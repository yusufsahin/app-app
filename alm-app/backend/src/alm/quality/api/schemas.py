"""Pydantic schemas for Quality API routes."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LastExecutionStatusRequest(BaseModel):
    test_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=200)


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
