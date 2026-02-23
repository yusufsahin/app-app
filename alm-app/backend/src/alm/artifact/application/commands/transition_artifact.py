"""Transition artifact workflow state."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.action_runner import run_actions
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.mpc_resolver import (
    check_transition_policies,
    get_transition_actions,
    get_workflow_engine,
)
from alm.project.domain.ports import ProjectRepository
from alm.process_template.domain.ports import ProcessTemplateRepository


@dataclass(frozen=True)
class TransitionArtifact(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    new_state: str
    updated_by: uuid.UUID | None = None


class TransitionArtifactHandler(CommandHandler[ArtifactDTO]):
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
        assert isinstance(command, TransitionArtifact)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        if project.process_template_version_id is None:
            raise ValidationError("Project has no process template")

        version = await self._process_template_repo.find_version_by_id(
            project.process_template_version_id
        )
        if version is None:
            raise ValidationError("Process template version not found")

        manifest = version.manifest_bundle or {}
        engine = get_workflow_engine(manifest, artifact.artifact_type)
        if engine is None or not engine.is_valid_transition(
            artifact.state, command.new_state
        ):
            raise ValidationError(
                f"Transition from '{artifact.state}' to '{command.new_state}' not allowed"
            )

        policy_violations = check_transition_policies(
            manifest,
            artifact.artifact_type,
            command.new_state,
            artifact.to_snapshot_dict(),
        )
        if policy_violations:
            raise ValidationError("; ".join(policy_violations))

        from_state = artifact.state
        to_state = command.new_state
        actions = get_transition_actions(
            manifest, artifact.artifact_type, from_state, to_state
        )

        run_actions(
            actions["on_leave"],
            artifact_id=artifact.id,
            project_id=artifact.project_id,
            from_state=from_state,
            to_state=to_state,
        )

        artifact.transition(to_state)
        artifact.updated_by = command.updated_by
        await self._artifact_repo.update(artifact)

        run_actions(
            actions["on_enter"],
            artifact_id=artifact.id,
            project_id=artifact.project_id,
            from_state=from_state,
            to_state=to_state,
        )

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
