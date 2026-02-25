"""Attachment domain entity — file linked to an artifact."""
from __future__ import annotations

import uuid
from datetime import datetime

from alm.shared.domain.aggregate import AggregateRoot


class Attachment(AggregateRoot):
    """File attached to an artifact."""

    def __init__(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        file_name: str,
        content_type: str,
        size: int,
        storage_key: str,
        created_by: uuid.UUID | None,
        *,
        id: uuid.UUID | None = None,
        created_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.artifact_id = artifact_id
        self.file_name = file_name
        self.content_type = content_type
        self.size = size
        self.storage_key = storage_key
        self.created_by = created_by
        self.created_at = created_at

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        file_name: str,
        content_type: str,
        size: int,
        storage_key: str,
        created_by: uuid.UUID | None,
        *,
        id: uuid.UUID | None = None,
    ) -> "Attachment":
        return cls(
            project_id=project_id,
            artifact_id=artifact_id,
            file_name=file_name,
            content_type=content_type,
            size=size,
            storage_key=storage_key,
            created_by=created_by,
            id=id,
        )

    def to_snapshot_dict(self) -> dict:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "artifact_id": str(self.artifact_id),
            "file_name": self.file_name,
            "content_type": self.content_type,
            "size": self.size,
            "storage_key": self.storage_key,
            "created_by": str(self.created_by) if self.created_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
