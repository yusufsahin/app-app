"""Artifact domain entities."""
from __future__ import annotations

import uuid

from alm.shared.domain.aggregate import AggregateRoot


class Artifact(AggregateRoot):
    """Work item: requirement, defect, epic, etc. Workflow state driven by manifest.
    Supports hierarchy via parent_id (epic → feature → requirement)."""

    def __init__(
        self,
        project_id: uuid.UUID,
        artifact_type: str,
        title: str,
        state: str,
        *,
        id: uuid.UUID | None = None,
        description: str = "",
        assignee_id: uuid.UUID | None = None,
        parent_id: uuid.UUID | None = None,
        custom_fields: dict | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.artifact_type = artifact_type
        self.title = title
        self.description = description
        self.state = state
        self.assignee_id = assignee_id
        self.parent_id = parent_id
        self.custom_fields = custom_fields or {}

    def transition(self, new_state: str) -> None:
        """Change workflow state (validated by manifest workflow engine)."""
        self.state = new_state
        self.touch()

    def to_snapshot_dict(self) -> dict:
        """Entity snapshot for MPC PolicyEngine (domain-agnostic dict)."""
        return {
            "assignee_id": str(self.assignee_id) if self.assignee_id else None,
            "custom_fields": self.custom_fields,
            "state": self.state,
            "artifact_type": self.artifact_type,
        }
