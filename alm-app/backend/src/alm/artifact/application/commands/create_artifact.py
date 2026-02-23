"""Create artifact command."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.mpc_resolver import (
    get_workflow_engine,
    is_valid_parent_child,
)
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
    created_by: uuid.UUID | None = None


class CreateArtifactHandler(CommandHandler[ArtifactDTO]):
    def __init__(
        self,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo

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
        engine = get_workflow_engine(manifest, command.artifact_type)
        if engine is None:
            raise ValidationError(
                f"Artifact type '{command.artifact_type}' not defined in manifest"
            )

        initial_state = engine.get_initial_state()

        if command.parent_id is not None:
            parent = await self._artifact_repo.find_by_id(command.parent_id)
            if parent is None or parent.project_id != command.project_id:
                raise ValidationError(
                    "Parent artifact not found or belongs to another project"
                )
            if not is_valid_parent_child(
                manifest, parent.artifact_type, command.artifact_type
            ):
                raise ValidationError(
                    f"Artifact type '{command.artifact_type}' cannot be child of "
                    f"'{parent.artifact_type}' per manifest hierarchy"
                )

        assignee = command.assignee_id or command.created_by
        artifact = Artifact(
            project_id=command.project_id,
            artifact_type=command.artifact_type,
            title=command.title.strip() or "Untitled",
            description=command.description,
            state=initial_state,
            parent_id=command.parent_id,
            assignee_id=assignee,
            custom_fields=command.custom_fields or {},
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
        )
