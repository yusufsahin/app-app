from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ProjectDTO:
    id: uuid.UUID
    code: str
    name: str
    slug: str
    description: str
    status: str | None = None
    settings: dict[str, Any] | None = None
    metadata_: dict[str, Any] | None = None


@dataclass(frozen=True)
class ProjectMemberDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role: str
