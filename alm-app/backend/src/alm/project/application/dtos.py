from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class ProjectDTO:
    id: uuid.UUID
    code: str
    name: str
    slug: str
    description: str
