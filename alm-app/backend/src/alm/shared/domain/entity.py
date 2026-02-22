from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any


def _serialize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    return value


class BaseEntity:
    def __init__(self, id: uuid.UUID | None = None) -> None:
        self.id = id or uuid.uuid4()
        self.created_at = datetime.now(UTC)
        self.created_by: uuid.UUID | None = None
        self.updated_at = datetime.now(UTC)
        self.updated_by: uuid.UUID | None = None
        self.deleted_at: datetime | None = None
        self.deleted_by: uuid.UUID | None = None
        self._events: list[Any] = []

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self, by: uuid.UUID) -> None:
        self.deleted_at = datetime.now(UTC)
        self.deleted_by = by
        self.updated_at = datetime.now(UTC)
        self.updated_by = by

    def restore(self, by: uuid.UUID | None = None) -> None:
        self.deleted_at = None
        self.deleted_by = None
        self.updated_at = datetime.now(UTC)
        self.updated_by = by

    def touch(self, by: uuid.UUID | None = None) -> None:
        self.updated_at = datetime.now(UTC)
        if by is not None:
            self.updated_by = by

    def to_snapshot_dict(self) -> dict[str, Any]:
        """Serialize all public attributes for audit snapshot storage."""
        return {
            key: _serialize_value(value)
            for key, value in self.__dict__.items()
            if not key.startswith("_")
        }

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, BaseEntity):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)
