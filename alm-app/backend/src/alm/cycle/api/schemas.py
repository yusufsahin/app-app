"""CycleNode API schemas (pamera IterationNode-like)."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class CycleNodeCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None
    sort_order: int = 0
    goal: str = ""
    start_date: date | None = None
    end_date: date | None = None
    state: str = "planned"
    kind: str = "iteration"  # "release" for root, "iteration" for child


class CycleNodeUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=255)
    goal: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    state: str | None = None
    sort_order: int | None = None
    kind: str | None = None  # "release" | "iteration"


class CycleNodeResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    path: str
    parent_id: uuid.UUID | None
    depth: int
    sort_order: int
    goal: str
    start_date: date | None
    end_date: date | None
    state: str
    kind: str  # "release" | "iteration"
    created_at: str | None
    updated_at: str | None
    children: list[Any] = []

    model_config = {"from_attributes": True}
