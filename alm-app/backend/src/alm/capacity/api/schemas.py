"""Capacity API schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel

from alm.capacity.application.dtos import CapacityDTO


class CapacityCreateRequest(BaseModel):
    cycle_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    capacity_value: float
    unit: str = "hours"


class CapacityUpdateRequest(BaseModel):
    cycle_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    capacity_value: float | None = None
    unit: str | None = None


class CapacityResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    cycle_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    capacity_value: float
    unit: str
    created_at: str | None = None
    updated_at: str | None = None


def capacity_response_from_dto(d: CapacityDTO) -> CapacityResponse:
    return CapacityResponse(
        id=d.id,
        project_id=d.project_id,
        cycle_id=d.cycle_id,
        team_id=d.team_id,
        user_id=d.user_id,
        capacity_value=d.capacity_value,
        unit=d.unit,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )

