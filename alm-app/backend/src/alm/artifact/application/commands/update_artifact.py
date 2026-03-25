"""Update artifact fields (title, description, assignee)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.area.domain.ports import AreaRepository
from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.manifest_workflow_metadata import is_system_root_artifact_type
from alm.artifact.domain.mpc_resolver import get_manifest_ast, is_valid_parent_child
from alm.artifact.domain.ports import ArtifactRepository
from alm.process_template.domain.ports import ProcessTemplateRepository
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
        process_template_repo: ProcessTemplateRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._area_repo = area_repo
        self._process_template_repo = process_template_repo

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
        manifest: dict = {}
        ast = None
        if project.process_template_version_id:
            ver = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
            if ver and ver.manifest_bundle:
                manifest = ver.manifest_bundle
                ast = get_manifest_ast(ver.id, manifest)

        if "parent_id" in updates:
            raw_pid = updates["parent_id"]
            if raw_pid is None:
                new_parent_id: uuid.UUID | None = None
            elif isinstance(raw_pid, uuid.UUID):
                new_parent_id = raw_pid
            else:
                s = str(raw_pid).strip()
                new_parent_id = uuid.UUID(s) if s else None

            if is_system_root_artifact_type(artifact.artifact_type, manifest):
                if new_parent_id is not None:
                    raise ValidationError("Cannot reparent a project root artifact")
            else:
                quality_types = frozenset({"test-case", "test-suite", "test-run", "test-campaign"})
                if artifact.artifact_type in quality_types:
                    if new_parent_id is None:
                        raise ValidationError(
                            f"Artifact type '{artifact.artifact_type}' must be under a 'quality-folder'"
                        )
                    parent = await self._artifact_repo.find_by_id(new_parent_id)
                    if parent is None or parent.project_id != command.project_id:
                        raise ValidationError("Parent artifact not found or belongs to another project")
                    if parent.artifact_type != "quality-folder":
                        raise ValidationError(
                            f"Artifact type '{artifact.artifact_type}' must be under a 'quality-folder'"
                        )
                    if not is_valid_parent_child(manifest, parent.artifact_type, artifact.artifact_type, ast=ast):
                        raise ValidationError(
                            f"Artifact type '{artifact.artifact_type}' cannot be child of "
                            f"'{parent.artifact_type}' per manifest hierarchy"
                        )
                    artifact.parent_id = new_parent_id
                elif new_parent_id is not None:
                    parent = await self._artifact_repo.find_by_id(new_parent_id)
                    if parent is None or parent.project_id != command.project_id:
                        raise ValidationError("Parent artifact not found or belongs to another project")
                    if not is_valid_parent_child(manifest, parent.artifact_type, artifact.artifact_type, ast=ast):
                        raise ValidationError(
                            f"Artifact type '{artifact.artifact_type}' cannot be child of "
                            f"'{parent.artifact_type}' per manifest hierarchy"
                        )
                    artifact.parent_id = new_parent_id
                else:
                    artifact.parent_id = None

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

        if "custom_fields" in updates and updates["custom_fields"] is not None:
            merged = dict(artifact.custom_fields or {})
            merged.update(updates["custom_fields"])
            artifact.custom_fields = merged

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
