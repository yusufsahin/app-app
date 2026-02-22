from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class PropertyChangeSchema(BaseModel):
    property_name: str
    left: Any = None
    right: Any = None


class SnapshotSchema(BaseModel):
    id: uuid.UUID
    commit_id: uuid.UUID
    global_id: str
    entity_type: str
    entity_id: uuid.UUID
    change_type: str
    state: dict[str, Any]
    changed_properties: list[str]
    version: int
    committed_at: datetime | None = None
    author_id: uuid.UUID | None = None


class ChangeSchema(BaseModel):
    snapshot: SnapshotSchema
    changes: list[PropertyChangeSchema]


class EntityHistorySchema(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    total_versions: int
    entries: list[ChangeSchema]
