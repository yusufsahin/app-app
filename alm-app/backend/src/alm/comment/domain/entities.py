"""Comment domain entity — artifact-linked note."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from alm.shared.domain.aggregate import AggregateRoot


class Comment(AggregateRoot):
    """Comment on an artifact."""

    def __init__(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        body: str,
        created_by: uuid.UUID,
        *,
        id: uuid.UUID | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.artifact_id = artifact_id
        self.body = body
        self.created_by = created_by
        self.created_at = created_at
        self.updated_at = updated_at

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        body: str,
        created_by: uuid.UUID,
        *,
        id: uuid.UUID | None = None,
    ) -> Comment:
        return cls(
            project_id=project_id,
            artifact_id=artifact_id,
            body=body,
            created_by=created_by,
            id=id,
        )

    def to_snapshot_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "artifact_id": str(self.artifact_id),
            "body": self.body,
            "created_by": str(self.created_by),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
