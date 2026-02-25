"""Team and TeamMember domain entities (P6 — Team context)."""

from __future__ import annotations

import uuid
from datetime import datetime

from alm.shared.domain.aggregate import AggregateRoot


class Team(AggregateRoot):
    """Team under a project."""

    def __init__(
        self,
        project_id: uuid.UUID,
        name: str,
        *,
        id: uuid.UUID | None = None,
        description: str = "",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.name = (name or "").strip()
        self.description = description or ""
        self.created_at = created_at
        self.updated_at = updated_at

    def update(self, name: str | None = None, description: str | None = None) -> None:
        if name is not None:
            self.name = (name or "").strip()
        if description is not None:
            self.description = description or ""


class TeamMember:
    """User membership in a team (value object / entity without aggregate root)."""

    def __init__(
        self,
        team_id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        role: str = "member",
    ) -> None:
        self.team_id = team_id
        self.user_id = user_id
        self.role = (role or "member").strip() or "member"
