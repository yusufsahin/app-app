"""Cadence domain entity for release/cycle planning."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from alm.shared.domain.aggregate import AggregateRoot

CADENCE_TYPE_RELEASE = "release"
CADENCE_TYPE_CYCLE = "cycle"
CadenceType = Literal["release", "cycle"]


class Cadence(AggregateRoot):
    """Node in the release/cycle tree."""

    def __init__(
        self,
        project_id: uuid.UUID,
        name: str,
        path: str,
        *,
        id: uuid.UUID | None = None,
        parent_id: uuid.UUID | None = None,
        depth: int = 0,
        sort_order: int = 0,
        goal: str = "",
        start_date: date | None = None,
        end_date: date | None = None,
        state: str = "planned",
        type: CadenceType = "cycle",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.name = name
        self.path = path
        self.parent_id = parent_id
        self.depth = depth
        self.sort_order = sort_order
        self.goal = goal
        self.start_date = start_date
        self.end_date = end_date
        self.state = state
        self.type = type
        self.created_at = created_at
        self.updated_at = updated_at

    @classmethod
    def create_root(
        cls,
        project_id: uuid.UUID,
        name: str,
        *,
        id: uuid.UUID | None = None,
        sort_order: int = 0,
        goal: str = "",
        start_date: date | None = None,
        end_date: date | None = None,
        state: str = "planned",
        type: CadenceType = "release",
    ) -> Cadence:
        name_trim = (name or "").strip()
        if not name_trim:
            raise ValueError("Cadence name cannot be empty")
        return cls(
            project_id=project_id,
            name=name_trim,
            path=name_trim,
            id=id,
            parent_id=None,
            depth=0,
            sort_order=sort_order,
            goal=goal,
            start_date=start_date,
            end_date=end_date,
            state=state,
            type=type,
        )

    @classmethod
    def create_child(
        cls,
        project_id: uuid.UUID,
        name: str,
        parent: Cadence,
        *,
        id: uuid.UUID | None = None,
        sort_order: int = 0,
        goal: str = "",
        start_date: date | None = None,
        end_date: date | None = None,
        state: str = "planned",
        type: CadenceType = "cycle",
    ) -> Cadence:
        if parent.project_id != project_id:
            raise ValueError("Parent must belong to the same project")
        name_trim = (name or "").strip()
        if not name_trim:
            raise ValueError("Cadence name cannot be empty")
        path = f"{parent.path}/{name_trim}"
        return cls(
            project_id=project_id,
            name=name_trim,
            path=path,
            id=id,
            parent_id=parent.id,
            depth=parent.depth + 1,
            sort_order=sort_order,
            goal=goal,
            start_date=start_date,
            end_date=end_date,
            state=state,
            type=type,
        )

    def to_snapshot_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "name": self.name,
            "path": self.path,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "depth": self.depth,
            "sort_order": self.sort_order,
            "goal": self.goal,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "state": self.state,
            "type": self.type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
