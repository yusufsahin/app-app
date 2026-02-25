"""Workflow rule execution: run project rules when domain events fire (application layer uses runner port)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from alm.artifact.domain.events import ArtifactCreated, ArtifactStateChanged
from alm.shared.domain.events import DomainEvent
from alm.workflow_rule.domain.entities import TRIGGER_ARTIFACT_CREATED, TRIGGER_ARTIFACT_STATE_CHANGED
from alm.workflow_rule.domain.ports import IWorkflowRuleRunner


def create_workflow_rule_handlers(
    runner: IWorkflowRuleRunner,
) -> tuple[
    Callable[[DomainEvent], Awaitable[None]],
    Callable[[DomainEvent], Awaitable[None]],
]:
    """Returns (on_artifact_created_fn, on_artifact_state_changed_fn) that use the given runner."""

    async def on_artifact_created_workflow_rules(event: DomainEvent) -> None:
        if not isinstance(event, ArtifactCreated):
            return
        await runner.run(event.project_id, TRIGGER_ARTIFACT_CREATED, event)

    async def on_artifact_state_changed_workflow_rules(event: DomainEvent) -> None:
        if not isinstance(event, ArtifactStateChanged):
            return
        await runner.run(event.project_id, TRIGGER_ARTIFACT_STATE_CHANGED, event)

    return on_artifact_created_workflow_rules, on_artifact_state_changed_workflow_rules
