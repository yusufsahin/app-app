"""Artifact domain entities."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from alm.artifact.domain.events import ArtifactCreated, ArtifactStateChanged
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
        custom_fields: dict[str, Any] | None = None,
        artifact_key: str | None = None,
        state_reason: str | None = None,
        resolution: str | None = None,
        rank_order: float | None = None,
        cycle_node_id: uuid.UUID | None = None,
        area_node_id: uuid.UUID | None = None,
        area_path_snapshot: str | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> None:
        super().__init__(id=id)
        self.project_id = project_id
        self.artifact_type = artifact_type
        self.title = title
        self.description = description
        self.state = state
        self.assignee_id = assignee_id
        self.parent_id = parent_id
        self.cycle_node_id = cycle_node_id
        self.area_node_id = area_node_id
        self.area_path_snapshot = area_path_snapshot
        self.custom_fields: dict[str, Any] = custom_fields or {}
        self.artifact_key = artifact_key
        self.state_reason = state_reason
        self.resolution = resolution
        self.rank_order = rank_order
        self.created_at: datetime | None = created_at
        self.updated_at: datetime | None = updated_at

    @classmethod
    def create(
        cls,
        project_id: uuid.UUID,
        artifact_type: str,
        title: str,
        state: str,
        *,
        id: uuid.UUID | None = None,
        description: str = "",
        assignee_id: uuid.UUID | None = None,
        parent_id: uuid.UUID | None = None,
        custom_fields: dict[str, Any] | None = None,
        artifact_key: str | None = None,
        rank_order: float | None = None,
        cycle_node_id: uuid.UUID | None = None,
        area_node_id: uuid.UUID | None = None,
        area_path_snapshot: str | None = None,
    ) -> Artifact:
        """Create artifact and register ArtifactCreated domain event."""
        artifact = cls(
            project_id=project_id,
            artifact_type=artifact_type,
            title=title,
            state=state,
            id=id,
            description=description,
            assignee_id=assignee_id,
            parent_id=parent_id,
            custom_fields=custom_fields,
            artifact_key=artifact_key,
            rank_order=rank_order,
            cycle_node_id=cycle_node_id,
            area_node_id=area_node_id,
            area_path_snapshot=area_path_snapshot,
        )
        artifact._register_event(
            ArtifactCreated(
                project_id=project_id,
                artifact_id=artifact.id,
                artifact_type=artifact_type,
                title=title,
                state=state,
            )
        )
        return artifact

    def assign_area(self, area_node_id: uuid.UUID | None, path_snapshot: str | None) -> None:
        """Assign area by id and path snapshot (snapshot = node.path at assign time)."""
        self.area_node_id = area_node_id
        self.area_path_snapshot = path_snapshot

    def transition(
        self,
        new_state: str,
        *,
        state_reason: str | None = None,
        resolution: str | None = None,
    ) -> None:
        """Change workflow state (validated by manifest workflow engine)."""
        from_state = self.state
        self.state = new_state
        if state_reason is not None:
            self.state_reason = state_reason
        if resolution is not None:
            self.resolution = resolution
        self.touch()
        self._register_event(
            ArtifactStateChanged(
                artifact_id=self.id,
                project_id=self.project_id,
                from_state=from_state,
                to_state=new_state,
            )
        )

    def to_snapshot_dict(self) -> dict[str, Any]:
        """Entity snapshot for MPC PolicyEngine (domain-agnostic dict)."""
        return {
            "assignee_id": str(self.assignee_id) if self.assignee_id else None,
            "custom_fields": self.custom_fields,
            "state": self.state,
            "artifact_type": self.artifact_type,
        }
