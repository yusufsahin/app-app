"""Team DTOs (P6)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class TeamMemberDTO:
    team_id: uuid.UUID
    user_id: uuid.UUID
    role: str


@dataclass
class TeamDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str
    created_at: str | None
    updated_at: str | None
    members: list[TeamMemberDTO]
