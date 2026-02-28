"""Update artifact fields (title, description, assignee)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.area.domain.ports import AreaRepository
from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.constants import is_root_artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError


@dataclass(frozen=True)
class UpdateArtifact(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    updates: dict[str, Any]  # only keys present are updated; assignee_id: None clears assignee
    updated_by: uuid.UUID | None = None


class UpdateArtifactHandler(CommandHandler[ArtifactDTO]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        area_repo: AreaRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._area_repo = area_repo

    async def handle(self, command: Command) -> ArtifactDTO:
        assert isinstance(command, UpdateArtifact)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        if artifact.is_deleted:
            raise ValidationError("Cannot update a deleted artifact")

        updates = command.updates or {}
        if "parent_id" in updates and is_root_artifact(artifact.artifact_type):
            new_parent = updates["parent_id"]
            if new_parent is not None and str(new_parent).strip():
                raise ValidationError("Cannot reparent a project root artifact")

        if "title" in updates:
            title = updates["title"]
            artifact.title = (title.strip() if isinstance(title, str) else title) or artifact.title
        if "description" in updates:
            artifact.description = updates["description"] if updates["description"] is not None else ""
        if "assignee_id" in updates:
            val = updates["assignee_id"]
            artifact.assignee_id = uuid.UUID(str(val)) if val is not None and str(val).strip() else None
        if "cycle_node_id" in updates:
            val = updates["cycle_node_id"]
            artifact.cycle_node_id = uuid.UUID(str(val)) if val is not None and str(val).strip() else None
        if "area_node_id" in updates:
            val = updates["area_node_id"]
            area_node_id = uuid.UUID(str(val)) if val is not None and str(val).strip() else None
            path_snapshot: str | None = None
            if area_node_id:
                area_node = await self._area_repo.find_by_id(area_node_id)
                if area_node and area_node.project_id == command.project_id:
                    path_snapshot = area_node.path
            artifact.assign_area(area_node_id, path_snapshot)

        artifact.touch(by=command.updated_by)
        await self._artifact_repo.update(artifact)

        return ArtifactDTO(
            id=artifact.id,
            project_id=artifact.project_id,
            artifact_type=artifact.artifact_type,
            title=artifact.title,
            description=artifact.description,
            state=artifact.state,
            assignee_id=artifact.assignee_id,
            parent_id=artifact.parent_id,
            custom_fields=artifact.custom_fields,
            artifact_key=artifact.artifact_key,
            state_reason=artifact.state_reason,
            resolution=artifact.resolution,
            rank_order=artifact.rank_order,
            cycle_node_id=getattr(artifact, "cycle_node_id", None),
            area_node_id=getattr(artifact, "area_node_id", None),
            area_path_snapshot=getattr(artifact, "area_path_snapshot", None),
            created_at=getattr(artifact, "created_at", None),
            updated_at=getattr(artifact, "updated_at", None),
        )
