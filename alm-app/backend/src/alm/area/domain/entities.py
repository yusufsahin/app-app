"""AreaNode domain entity — project area tree (pamera AreaNode-like)."""
from __future__ import annotations

import uuid
from datetime import datetime

from alm.shared.domain.aggregate import AggregateRoot


class AreaNode(AggregateRoot):
    """Node in the area tree. Root has parent_id=None, path=name; child has path=parent.path + '/' + name.
    Supports rename/move with path subtree update; is_active for soft delete."""

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
        is_active: bool = True,
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
        self.is_active = is_active
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
    ) -> "AreaNode":
        name_trim = (name or "").strip()
        if not name_trim:
            raise ValueError("Area node name cannot be empty")
        return cls(
            project_id=project_id,
            name=name_trim,
            path=name_trim,
            id=id,
            parent_id=None,
            depth=0,
            sort_order=sort_order,
            is_active=True,
        )

    @classmethod
    def create_child(
        cls,
        project_id: uuid.UUID,
        name: str,
        parent: "AreaNode",
        *,
        id: uuid.UUID | None = None,
        sort_order: int = 0,
    ) -> "AreaNode":
        if parent.project_id != project_id:
            raise ValueError("Parent must belong to the same project")
        name_trim = (name or "").strip()
        if not name_trim:
            raise ValueError("Area node name cannot be empty")
        path = f"{parent.path}/{name_trim}"
        return cls(
            project_id=project_id,
            name=name_trim,
            path=path,
            id=id,
            parent_id=parent.id,
            depth=parent.depth + 1,
            sort_order=sort_order,
            is_active=True,
        )

    def set_name(self, name: str) -> None:
        if name and name.strip():
            self.name = name.strip()

    def set_path(self, path: str) -> None:
        if path is not None:
            self.path = path

    def set_parent_id(self, parent_id: uuid.UUID | None) -> None:
        self.parent_id = parent_id

    def set_depth(self, depth: int) -> None:
        self.depth = depth

    def set_sort_order(self, sort_order: int) -> None:
        self.sort_order = sort_order

    def set_active(self, is_active: bool) -> None:
        self.is_active = is_active

    def to_snapshot_dict(self) -> dict:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "name": self.name,
            "path": self.path,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "depth": self.depth,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
