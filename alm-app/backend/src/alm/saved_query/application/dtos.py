"""SavedQuery DTOs."""
from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class SavedQueryDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    visibility: str
    filter_params: dict
    created_at: str | None
    updated_at: str | None
