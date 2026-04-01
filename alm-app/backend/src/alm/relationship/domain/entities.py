"""Relationship domain entity for directed artifact relationships."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from alm.shared.domain.aggregate import AggregateRoot


class Relationship(AggregateRoot):
    """Directed relationship between two artifacts with a relationship type."""

    def __init__(
        self,
        project_id: uuid.UUID,
        source_artifact_id: uuid.UUID,
        target_artifact_id: uuid.UUID,
        relationship_type: str,
        *,
        id: uuid.UUID | None = None,
        created_at: datetime | None = None,
        sort_order: int | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.source_artifact_id = source_artifact_id
        self.target_artifact_id = target_artifact_id
        self.relationship_type = relationship_type
        self.created_at = created_at
        self.sort_order = sort_order

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        source_artifact_id: uuid.UUID,
        target_artifact_id: uuid.UUID,
        relationship_type: str,
        *,
        id: uuid.UUID | None = None,
        sort_order: int | None = None,
    ) -> Relationship:
        return cls(
            project_id=project_id,
            source_artifact_id=source_artifact_id,
            target_artifact_id=target_artifact_id,
            relationship_type=relationship_type,
            id=id,
            sort_order=sort_order,
        )

    def to_snapshot_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "source_artifact_id": str(self.source_artifact_id),
            "target_artifact_id": str(self.target_artifact_id),
            "relationship_type": self.relationship_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "sort_order": self.sort_order,
        }
