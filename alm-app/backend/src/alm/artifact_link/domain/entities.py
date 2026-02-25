"""ArtifactLink domain entity — traceability link between two artifacts."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from alm.shared.domain.aggregate import AggregateRoot


class ArtifactLink(AggregateRoot):
    """Directed link between two artifacts (from_artifact_id -> to_artifact_id) with a link type."""

    def __init__(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        to_artifact_id: uuid.UUID,
        link_type: str,
        *,
        id: uuid.UUID | None = None,
        created_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.from_artifact_id = from_artifact_id
        self.to_artifact_id = to_artifact_id
        self.link_type = link_type
        self.created_at = created_at

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        to_artifact_id: uuid.UUID,
        link_type: str,
        *,
        id: uuid.UUID | None = None,
    ) -> ArtifactLink:
        return cls(
            project_id=project_id,
            from_artifact_id=from_artifact_id,
            to_artifact_id=to_artifact_id,
            link_type=link_type,
            id=id,
        )

    def to_snapshot_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "from_artifact_id": str(self.from_artifact_id),
            "to_artifact_id": str(self.to_artifact_id),
            "link_type": self.link_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
