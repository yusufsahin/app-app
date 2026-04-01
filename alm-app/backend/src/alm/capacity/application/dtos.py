"""Capacity DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class CapacityDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    cycle_id: uuid.UUID | None
    team_id: uuid.UUID | None
    user_id: uuid.UUID | None
    capacity_value: float
    unit: str
    created_at: str | None
    updated_at: str | None

