"""WorkflowRule DTOs."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any


@dataclass
class WorkflowRuleDTO:
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    trigger_event_type: str
    condition_expression: str | None
    actions: list[dict[str, Any]]
    is_active: bool
    created_at: str | None
    updated_at: str | None
