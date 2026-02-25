"""Transition artifact workflow state."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, ValidationError
from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.action_runner import run_actions
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact.domain.mpc_resolver import (
    check_transition_policies,
    evaluate_transition_policy,
    get_artifact_type_def,
    get_manifest_ast,
    get_transition_actions,
    get_workflow_engine,
    get_workflow_transition_options,
)
from alm.project.domain.ports import ProjectRepository
from alm.process_template.domain.ports import ProcessTemplateRepository


def _build_transition_event(
    artifact: Any,
    command: "TransitionArtifact",
) -> dict[str, Any]:
    """Build event dict for MPC PolicyEngine (D1)."""
    snapshot = artifact.to_snapshot_dict()
    return {
        "kind": "transition",
        "name": "artifact.transition",
        "object": {
            "id": str(artifact.id),
            "type": "artifact",
            "artifact_type": artifact.artifact_type,
            "state": snapshot.get("state"),
            "assignee_id": snapshot.get("assignee_id"),
            "custom_fields": snapshot.get("custom_fields") or {},
        },
        "actor": {
            "id": str(command.updated_by) if command.updated_by else "",
            "type": "user",
            "tenant_id": str(command.tenant_id),
            "roles": list(command.actor_roles) if command.actor_roles else [],
        },
        "context": {
            "from_state": artifact.state,
            "to_state": command.new_state,
            "project_id": str(command.project_id),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@dataclass(frozen=True)
class TransitionArtifact(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    new_state: str
    state_reason: str | None = None
    resolution: str | None = None
    updated_by: uuid.UUID | None = None
    expected_updated_at: str | None = None  # optimistic lock; mismatch -> 409
    actor_roles: tuple[str, ...] | None = None  # for MPC PolicyEngine (D1)


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

        if command.expected_updated_at and (s := command.expected_updated_at.strip()):
            try:
                expected_dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            except ValueError:
                pass
            else:
                server_dt = getattr(artifact, "updated_at", None)
                if server_dt is not None:
                    if server_dt.tzinfo is None:
                        server_dt = server_dt.replace(tzinfo=timezone.utc)
                    if expected_dt.tzinfo is None:
                        expected_dt = expected_dt.replace(tzinfo=timezone.utc)
                    if server_dt != expected_dt:
                        raise ConflictError(
                            "Artifact was modified by someone else. Refresh or choose Overwrite to apply your change."
                        )

        if project.process_template_version_id is None:
            raise ValidationError("Project has no process template")

        version = await self._process_template_repo.find_version_by_id(
            project.process_template_version_id
        )
        if version is None:
            raise ValidationError("Process template version not found")

        manifest = version.manifest_bundle or {}
        ast = get_manifest_ast(version.id, manifest)
        engine = get_workflow_engine(manifest, artifact.artifact_type, ast=ast)
        if engine is None or not engine.is_valid_transition(
            artifact.state, command.new_state
        ):
            raise ValidationError(
                f"Transition from '{artifact.state}' to '{command.new_state}' not allowed"
            )

        # Manifest-based transition policies (e.g. assignee required when entering state)
        policy_violations = list(
            check_transition_policies(
                manifest,
                command.new_state,
                artifact.to_snapshot_dict(),
                type_id=artifact.artifact_type,
                ast=ast,
            )
        )
        # D1: MPC PolicyEngine — event-based policy evaluation; merge violations
        event = _build_transition_event(artifact, command)
        allow, mpc_violations = evaluate_transition_policy(
            ast, event, list(command.actor_roles) if command.actor_roles else None
        )
        if not allow and mpc_violations:
            policy_violations.extend(mpc_violations)
        if policy_violations:
            raise ValidationError("; ".join(policy_violations))

        at_def = get_artifact_type_def(manifest, artifact.artifact_type, ast=ast)
        workflow_id = (at_def or {}).get("workflow_id") or ""
        allowed_reasons, allowed_resolutions = get_workflow_transition_options(
            manifest, workflow_id
        )
        if allowed_reasons and command.state_reason is not None and command.state_reason != "":
            if command.state_reason not in allowed_reasons:
                raise ValidationError(
                    f"state_reason must be one of: {', '.join(allowed_reasons)}"
                )
        if allowed_resolutions and command.resolution is not None and command.resolution != "":
            if command.resolution not in allowed_resolutions:
                raise ValidationError(
                    f"resolution must be one of: {', '.join(allowed_resolutions)}"
                )

        # Require resolution when transitioning to a resolved/closed/done state
        _RESOLVED_STATES = ("resolved", "closed", "done")
        if (
            command.new_state in _RESOLVED_STATES
            and allowed_resolutions
            and (not command.resolution or command.resolution.strip() == "")
        ):
            raise ValidationError(
                "resolution is required when transitioning to a resolved, closed, or done state"
            )

        from_state = artifact.state
        to_state = command.new_state
        actions = get_transition_actions(
            manifest, artifact.artifact_type, from_state, to_state, ast=ast
        )

        run_actions(
            actions["on_leave"],
            artifact_id=artifact.id,
            project_id=artifact.project_id,
            from_state=from_state,
            to_state=to_state,
        )

        artifact.transition(
            to_state,
            state_reason=command.state_reason,
            resolution=command.resolution,
        )
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
            cycle_node_id=getattr(artifact, "cycle_node_id", None),
            area_node_id=getattr(artifact, "area_node_id", None),
            area_path_snapshot=getattr(artifact, "area_path_snapshot", None),
            custom_fields=artifact.custom_fields,
            artifact_key=artifact.artifact_key,
            state_reason=artifact.state_reason,
            resolution=artifact.resolution,
            rank_order=artifact.rank_order,
            created_at=getattr(artifact, "created_at", None),
            updated_at=getattr(artifact, "updated_at", None),
        )
