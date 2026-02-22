from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass(frozen=True, kw_only=True)
class DomainEvent:
    """Base for all domain events. kw_only=True allows subclasses to define
    required fields without conflicting with these default-valued fields."""

    event_id: uuid.UUID = field(default_factory=uuid.uuid4)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    schema_version: int = 1
