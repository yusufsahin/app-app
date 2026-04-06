"""Cadence DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date


@dataclass
class CadenceDTO:
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
    type: str  # "release" | "cycle"
    created_at: str | None
    updated_at: str | None
    children: list[CadenceDTO] = field(default_factory=list)
