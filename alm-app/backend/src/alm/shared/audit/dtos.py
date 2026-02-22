from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class SnapshotDTO:
    id: uuid.UUID
    commit_id: uuid.UUID
    global_id: str
    entity_type: str
    entity_id: uuid.UUID
    change_type: str
    state: dict[str, Any]
    changed_properties: list[str]
    version: int
    committed_at: datetime
    author_id: uuid.UUID | None


@dataclass(frozen=True)
class PropertyChangeDTO:
    property_name: str
    left: Any = None
    right: Any = None


@dataclass(frozen=True)
class ChangeDTO:
    """A single version with its diff against the previous version."""

    snapshot: SnapshotDTO
    changes: list[PropertyChangeDTO] = field(default_factory=list)


@dataclass(frozen=True)
class EntityHistoryDTO:
    entity_type: str
    entity_id: uuid.UUID
    total_versions: int
    entries: list[ChangeDTO] = field(default_factory=list)
