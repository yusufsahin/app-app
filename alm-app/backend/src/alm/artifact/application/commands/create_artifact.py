"""Create artifact command."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.area.domain.ports import AreaRepository
from alm.artifact.domain.mpc_resolver import (
    get_manifest_ast,
    is_valid_parent_child,
)
from alm.artifact.domain.workflow_sm import get_initial_state as workflow_get_initial_state
from alm.project.domain.ports import ProjectRepository
from alm.process_template.domain.ports import ProcessTemplateRepository


@dataclass(frozen=True)
class CreateArtifact(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_type: str
    title: str
    description: str = ""
    parent_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    artifact_key: str | None = None
    rank_order: float | None = None
    cycle_node_id: uuid.UUID | None = None
    area_node_id: uuid.UUID | None = None
    created_by: uuid.UUID | None = None


class CreateArtifactHandler(CommandHandler[ArtifactDTO]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
        area_repo: AreaRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._area_repo = area_repo

    async def handle(self, command: Command) -> ArtifactDTO:
        assert isinstance(command, CreateArtifact)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        if project.process_template_version_id is None:
            raise ValidationError("Project has no process template")

        version = await self._process_template_repo.find_version_by_id(
            project.process_template_version_id
        )
        if version is None:
            raise ValidationError("Process template version not found")

        manifest = version.manifest_bundle or {}
        ast = get_manifest_ast(version.id, manifest)
        initial_state = workflow_get_initial_state(manifest, command.artifact_type, ast=ast)
        if initial_state is None:
            raise ValidationError(
                f"Artifact type '{command.artifact_type}' not defined in manifest"
            )

        if command.parent_id is not None:
            parent = await self._artifact_repo.find_by_id(command.parent_id)
            if parent is None or parent.project_id != command.project_id:
                raise ValidationError(
                    "Parent artifact not found or belongs to another project"
                )
            if not is_valid_parent_child(
                manifest, parent.artifact_type, command.artifact_type, ast=ast
            ):
                raise ValidationError(
                    f"Artifact type '{command.artifact_type}' cannot be child of "
                    f"'{parent.artifact_type}' per manifest hierarchy"
                )

        artifact_key = command.artifact_key
        if artifact_key is None or artifact_key.strip() == "":
            seq = await self._project_repo.increment_artifact_seq(command.project_id)
            artifact_key = f"{project.code}-{seq}"

        assignee = command.assignee_id or command.created_by
        area_path_snapshot: str | None = None
        if command.area_node_id:
            area_node = await self._area_repo.find_by_id(command.area_node_id)
            if area_node and area_node.project_id == command.project_id:
                area_path_snapshot = area_node.path
        artifact = Artifact.create(
            project_id=command.project_id,
            artifact_type=command.artifact_type,
            title=command.title.strip() or "Untitled",
            description=command.description,
            state=initial_state,
            parent_id=command.parent_id,
            assignee_id=assignee,
            custom_fields=command.custom_fields or {},
            artifact_key=artifact_key,
            rank_order=command.rank_order,
            cycle_node_id=command.cycle_node_id,
            area_node_id=command.area_node_id,
            area_path_snapshot=area_path_snapshot,
        )
        artifact.created_by = command.created_by
        await self._artifact_repo.add(artifact)

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
