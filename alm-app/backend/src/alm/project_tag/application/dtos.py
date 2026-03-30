"""Project tag DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ProjectTagDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
