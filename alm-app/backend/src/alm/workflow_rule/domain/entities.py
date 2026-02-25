"""WorkflowRule domain entity — event-triggered automation rule."""
from __future__ import annotations

import uuid
from datetime import datetime

from alm.shared.domain.aggregate import AggregateRoot


# Known trigger event types (domain events)
TRIGGER_ARTIFACT_CREATED = "artifact_created"
TRIGGER_ARTIFACT_STATE_CHANGED = "artifact_state_changed"

TRIGGER_EVENT_TYPES = (TRIGGER_ARTIFACT_CREATED, TRIGGER_ARTIFACT_STATE_CHANGED)


class WorkflowRule(AggregateRoot):
    """Rule that runs when a domain event matches: trigger_event_type + optional condition → actions."""

    def __init__(
        self,
        project_id: uuid.UUID,
        name: str,
        trigger_event_type: str,
        actions: list[dict],
        *,
        id: uuid.UUID | None = None,
        condition_expression: str | None = None,
        is_active: bool = True,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.name = name
        self.trigger_event_type = trigger_event_type
        self.condition_expression = condition_expression
        self.actions = actions or []
        self.is_active = is_active
        self.created_at = created_at
        self.updated_at = updated_at

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        name: str,
        trigger_event_type: str,
        actions: list[dict],
        *,
        id: uuid.UUID | None = None,
        condition_expression: str | None = None,
        is_active: bool = True,
    ) -> "WorkflowRule":
        return cls(
            project_id=project_id,
            name=name,
            trigger_event_type=trigger_event_type,
            actions=actions,
            id=id,
            condition_expression=condition_expression,
            is_active=is_active,
        )

    def to_snapshot_dict(self) -> dict:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "name": self.name,
            "trigger_event_type": self.trigger_event_type,
            "condition_expression": self.condition_expression,
            "actions": self.actions,
            "is_active": self.is_active,
        }
