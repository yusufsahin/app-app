"""Transition artifact workflow state."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import structlog

from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.action_runner import run_actions
from alm.artifact.domain.guard_evaluator import evaluate_guard
from alm.artifact.domain.mpc_resolver import (
    check_transition_policies,
    evaluate_transition_policy,
    get_artifact_type_def,
    get_manifest_ast,
    get_transition_actions,
    get_workflow_transition_options,
)
from alm.artifact.domain.ports import ArtifactRepository, IArtifactTransitionMetrics
from alm.artifact.domain.workflow_sm import (
    get_permitted_triggers,
    get_transition_guard,
)
from alm.artifact.domain.workflow_sm import (
    is_valid_transition as workflow_is_valid_transition,
)
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ConflictError, PolicyDeniedError, ValidationError


def _build_transition_event(
    artifact: Any,
    command: TransitionArtifact,
    *,
    resolved_new_state: str | None = None,
) -> dict[str, Any]:
    """Build event dict for MPC PolicyEngine (D1)."""
    to_state = resolved_new_state if resolved_new_state is not None else (command.new_state or "")
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
            "to_state": to_state,
            "project_id": str(command.project_id),
        },
        "timestamp": datetime.now(UTC).isoformat(),
    }


@dataclass(frozen=True)
class TransitionArtifact(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    new_state: str | None = None  # target state id; use when client sends new_state
    trigger: str | None = None  # trigger id from manifest; resolved to to_state in handler
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
        metrics: IArtifactTransitionMetrics,
    ) -> None:
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._metrics = metrics

    async def handle(self, command: Command) -> ArtifactDTO:
        assert isinstance(command, TransitionArtifact)
        start = time.monotonic()
        try:
            result = await self._handle_impl(command)
            self._metrics.record_duration_seconds(time.monotonic() - start)
            return result
        except PolicyDeniedError:
            self._metrics.record_duration_seconds(time.monotonic() - start)
            self._metrics.record_result("policy_denied")
            raise
        except ValidationError:
            self._metrics.record_duration_seconds(time.monotonic() - start)
            self._metrics.record_result("validation_error")
            raise
        except ConflictError:
            self._metrics.record_duration_seconds(time.monotonic() - start)
            self._metrics.record_result("conflict_error")
            raise

    async def _handle_impl(self, command: TransitionArtifact) -> ArtifactDTO:
        if not command.trigger and not command.new_state:
            raise ValidationError("Either trigger or new_state is required")

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        if project.process_template_version_id is None:
            raise ValidationError("Project has no process template")
        version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        if version is None:
            raise ValidationError("Process template version not found")
        manifest = version.manifest_bundle or {}
        ast = get_manifest_ast(version.id, manifest)

        # Resolve trigger to target state when client sent trigger
        if command.trigger:
            permitted = get_permitted_triggers(manifest, artifact.artifact_type, artifact.state, ast=ast)
            match = next((p for p in permitted if p[0] == command.trigger), None)
            if not match:
                raise ValidationError(f"Trigger '{command.trigger}' is not permitted from state '{artifact.state}'")
            new_state = match[1]
        else:
            new_state = (command.new_state or "").strip()
            if not new_state:
                raise ValidationError("new_state is required when trigger is not set")

        if command.expected_updated_at and (s := command.expected_updated_at.strip()):
            try:
                expected_dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            except ValueError:
                pass
            else:
                server_dt = getattr(artifact, "updated_at", None)
                if server_dt is not None:
                    if server_dt.tzinfo is None:
                        server_dt = server_dt.replace(tzinfo=UTC)
                    if expected_dt.tzinfo is None:
                        expected_dt = expected_dt.replace(tzinfo=UTC)
                    if server_dt != expected_dt:
                        raise ConflictError(
                            "Artifact was modified by someone else. Refresh or choose Overwrite to apply your change."
                        )

        if not workflow_is_valid_transition(
            manifest,
            artifact.artifact_type,
            artifact.state,
            new_state,
            ast=ast,
        ):
            raise ValidationError(f"Transition from '{artifact.state}' to '{new_state}' not allowed")

        guard = get_transition_guard(
            manifest,
            artifact.artifact_type,
            artifact.state,
            new_state,
            ast=ast,
        )
        if guard is not None and not evaluate_guard(guard, artifact.to_snapshot_dict()):
            raise ValidationError("Transition guard not satisfied")

        # Manifest-based transition policies (e.g. assignee required when entering state)
        policy_violations = list(
            check_transition_policies(
                manifest,
                new_state,
                artifact.to_snapshot_dict(),
                type_id=artifact.artifact_type,
                ast=ast,
            )
        )
        # D1: MPC PolicyEngine — event-based policy evaluation; merge violations
        event = _build_transition_event(artifact, command, resolved_new_state=new_state)
        allow, mpc_violations = evaluate_transition_policy(
            ast, event, list(command.actor_roles) if command.actor_roles else None
        )
        if not allow and mpc_violations:
            policy_violations.extend(mpc_violations)
        if policy_violations:
            raise PolicyDeniedError("; ".join(policy_violations))

        at_def = get_artifact_type_def(manifest, artifact.artifact_type, ast=ast)
        workflow_id = (at_def or {}).get("workflow_id") or ""
        allowed_reasons, allowed_resolutions = get_workflow_transition_options(manifest, workflow_id)
        if allowed_reasons and command.state_reason is not None and command.state_reason != "":
            if command.state_reason not in allowed_reasons:
                raise ValidationError(f"state_reason must be one of: {', '.join(allowed_reasons)}")
        if allowed_resolutions and command.resolution is not None and command.resolution != "":
            if command.resolution not in allowed_resolutions:
                raise ValidationError(f"resolution must be one of: {', '.join(allowed_resolutions)}")

        # Require resolution when transitioning to a resolved/closed/done state
        _RESOLVED_STATES = ("resolved", "closed", "done")
        if (
            new_state in _RESOLVED_STATES
            and allowed_resolutions
            and (not command.resolution or command.resolution.strip() == "")
        ):
            raise ValidationError("resolution is required when transitioning to a resolved, closed, or done state")

        from_state = artifact.state
        to_state = new_state
        actions = get_transition_actions(manifest, artifact.artifact_type, from_state, to_state, ast=ast)

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

        self._metrics.record_result("success")
        structlog.get_logger().info(
            "artifact_transition",
            artifact_id=str(artifact.id),
            from_state=from_state,
            to_state=to_state,
            trigger=command.trigger,
            project_id=str(artifact.project_id),
        )
        try:
            from opentelemetry import trace

            span = trace.get_current_span()
            if span.is_recording():
                span.set_attribute("artifact.id", str(artifact.id))
                span.set_attribute("artifact.transition.from_state", from_state)
                span.set_attribute("artifact.transition.to_state", to_state)
                if command.trigger:
                    span.set_attribute("artifact.transition.trigger", command.trigger)
        except Exception:  # noqa: S110
            pass
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
