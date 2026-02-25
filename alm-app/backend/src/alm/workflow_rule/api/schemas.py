"""WorkflowRule API schemas."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class WorkflowRuleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    trigger_event_type: str = Field(min_length=1, max_length=100)
    actions: list[dict[str, Any]] = Field(default_factory=list)
    condition_expression: str | None = None
    is_active: bool = True


class WorkflowRuleUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    trigger_event_type: str | None = Field(None, max_length=100)
    actions: list[dict[str, Any]] | None = None
    condition_expression: str | None = None
    is_active: bool | None = None


class WorkflowRuleResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    trigger_event_type: str
    condition_expression: str | None
    actions: list[dict[str, Any]]
    is_active: bool
    created_at: str | None
    updated_at: str | None
