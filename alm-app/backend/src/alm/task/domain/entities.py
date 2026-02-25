"""Task domain entity — artifact-linked work item."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from alm.shared.domain.aggregate import AggregateRoot


class Task(AggregateRoot):
    """Task linked to an artifact. Simple state: e.g. todo, in_progress, done."""

    def __init__(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        title: str,
        *,
        id: uuid.UUID | None = None,
        state: str = "todo",
        description: str = "",
        assignee_id: uuid.UUID | None = None,
        rank_order: float | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.artifact_id = artifact_id
        self.title = title
        self.state = state
        self.description = description
        self.assignee_id = assignee_id
        self.rank_order = rank_order
        self.created_at = created_at
        self.updated_at = updated_at

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        title: str,
        *,
        id: uuid.UUID | None = None,
        state: str = "todo",
        description: str = "",
        assignee_id: uuid.UUID | None = None,
        rank_order: float | None = None,
    ) -> Task:
        return cls(
            project_id=project_id,
            artifact_id=artifact_id,
            title=title,
            id=id,
            state=state,
            description=description,
            assignee_id=assignee_id,
            rank_order=rank_order,
        )

    def to_snapshot_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "artifact_id": str(self.artifact_id),
            "title": self.title,
            "state": self.state,
            "description": self.description,
            "assignee_id": str(self.assignee_id) if self.assignee_id else None,
            "rank_order": self.rank_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
