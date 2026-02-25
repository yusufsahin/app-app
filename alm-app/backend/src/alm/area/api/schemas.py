"""AreaNode API schemas (pamera AreaNode-like)."""
from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class AreaNodeCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None
    sort_order: int = 0


class AreaNodeUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=255)
    sort_order: int | None = None


class AreaNodeResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    path: str
    parent_id: uuid.UUID | None
    depth: int
    sort_order: int
    is_active: bool
    created_at: str | None
    updated_at: str | None
    children: list[Any] = []

    model_config = {"from_attributes": True}


class RenameAreaRequest(BaseModel):
    new_name: str = Field(min_length=1, max_length=255)


class MoveAreaRequest(BaseModel):
    new_parent_id: uuid.UUID | None = None  # None = move to root
