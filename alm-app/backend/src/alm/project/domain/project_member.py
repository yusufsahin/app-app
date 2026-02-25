"""ProjectMember domain entity — DDD."""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class ProjectMember:
    """Project membership: user has a role in a project."""

    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    role: str  # PROJECT_ADMIN, PROJECT_CONTRIBUTOR, PROJECT_VIEWER
