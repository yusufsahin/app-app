from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any


class BaseEntity:
    def __init__(self, id: uuid.UUID | None = None) -> None:
        self.id = id or uuid.uuid4()
        self.created_at = datetime.now(UTC)
        self.updated_at = datetime.now(UTC)
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

    def restore(self) -> None:
        self.deleted_at = None
        self.deleted_by = None
        self.updated_at = datetime.now(UTC)

    def touch(self) -> None:
        self.updated_at = datetime.now(UTC)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, BaseEntity):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)
