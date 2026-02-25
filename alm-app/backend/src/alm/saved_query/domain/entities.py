"""SavedQuery domain entity — saved filter set for artifact list."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from alm.shared.domain.aggregate import AggregateRoot


class SavedQuery(AggregateRoot):
    """Saved filter parameters for running an artifact list (name, owner, visibility, filter_params)."""

    def __init__(
        self,
        project_id: uuid.UUID,
        name: str,
        owner_id: uuid.UUID,
        filter_params: dict[str, Any],
        *,
        id: uuid.UUID | None = None,
        visibility: str = "private",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.name = name
        self.owner_id = owner_id
        self.visibility = visibility
        self.filter_params = filter_params or {}
        self.created_at = created_at
        self.updated_at = updated_at

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        name: str,
        owner_id: uuid.UUID,
        filter_params: dict[str, Any],
        *,
        id: uuid.UUID | None = None,
        visibility: str = "private",
    ) -> SavedQuery:
        return cls(
            project_id=project_id,
            name=name,
            owner_id=owner_id,
            filter_params=filter_params,
            id=id,
            visibility=visibility,
        )

    def to_snapshot_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "name": self.name,
            "owner_id": str(self.owner_id),
            "visibility": self.visibility,
            "filter_params": self.filter_params,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
