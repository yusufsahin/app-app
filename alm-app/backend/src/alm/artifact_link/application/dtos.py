"""ArtifactLink DTOs."""
from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class ArtifactLinkDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    from_artifact_id: uuid.UUID
    to_artifact_id: uuid.UUID
    link_type: str
    created_at: str | None
