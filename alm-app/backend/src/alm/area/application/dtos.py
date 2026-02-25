"""AreaNode DTOs."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
@dataclass
class AreaNodeDTO:
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
    children: list["AreaNodeDTO"] = field(default_factory=list)
