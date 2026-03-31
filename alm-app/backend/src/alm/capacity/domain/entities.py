"""Capacity domain entity (hybrid owner: team and/or user)."""

from __future__ import annotations

import uuid
from datetime import datetime

from alm.shared.domain.aggregate import AggregateRoot


class Capacity(AggregateRoot):
    def __init__(
        self,
        project_id: uuid.UUID,
        *,
        id: uuid.UUID | None = None,
        cycle_node_id: uuid.UUID | None = None,
        team_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        capacity_value: float = 0.0,
        unit: str = "hours",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.cycle_node_id = cycle_node_id
        self.team_id = team_id
        self.user_id = user_id
        self.capacity_value = float(capacity_value)
        self.unit = (unit or "hours").strip() or "hours"
        self.created_at = created_at
        self.updated_at = updated_at

