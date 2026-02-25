"""Workflow rule execution: run project rules when domain events fire."""
from __future__ import annotations

import structlog

from alm.artifact.domain.events import ArtifactCreated, ArtifactStateChanged
from alm.shared.domain.events import DomainEvent
from alm.shared.infrastructure.db.session import async_session_factory
from alm.workflow_rule.domain.entities import TRIGGER_ARTIFACT_CREATED, TRIGGER_ARTIFACT_STATE_CHANGED
from alm.workflow_rule.infrastructure.repositories import SqlAlchemyWorkflowRuleRepository

logger = structlog.get_logger()


def _event_context(event: DomainEvent) -> dict:
    """Build a safe context dict from event for condition/actions (e.g. artifact_id, project_id, to_state)."""
    if isinstance(event, ArtifactCreated):
        return {
            "artifact_id": str(event.artifact_id),
            "project_id": str(event.project_id),
            "artifact_type": event.artifact_type,
            "title": event.title,
            "state": event.state,
        }
    if isinstance(event, ArtifactStateChanged):
        return {
            "artifact_id": str(event.artifact_id),
            "project_id": str(event.project_id),
            "from_state": event.from_state,
            "to_state": event.to_state,
        }
    return {}


def _evaluate_condition(condition_expression: str | None, context: dict) -> bool:
    """Evaluate optional condition. Empty/None = always true. Future: simple expression eval."""
    if not condition_expression or not condition_expression.strip():
        return True
    # Placeholder: no real expression engine yet; could add a safe subset (e.g. to_state == "Done")
    return True


def _execute_actions(rule_id: str, rule_name: str, actions: list[dict], context: dict) -> None:
    """Execute action list. Supported: log, notification (log for now)."""
    for i, action in enumerate(actions):
        if not isinstance(action, dict):
            continue
        action_type = (action.get("type") or "").strip().lower()
        if action_type == "log":
            logger.info(
                "workflow_rule_log",
                rule_id=rule_id,
                rule_name=rule_name,
                context=context,
                message=action.get("message"),
            )
        elif action_type == "notification":
            logger.info(
                "workflow_rule_notification",
                rule_id=rule_id,
                rule_name=rule_name,
                context=context,
                channel=action.get("channel"),
                payload=action.get("payload"),
            )


async def _run_rules_for_trigger(project_id: str, trigger_event_type: str, event: DomainEvent) -> None:
    import uuid
    pid = uuid.UUID(project_id)
    rules_data: list[tuple[str, str, str | None, list[dict]]] = []
    async with async_session_factory() as session:
        repo = SqlAlchemyWorkflowRuleRepository(session)
        rules = await repo.list_active_by_trigger(pid, trigger_event_type)
        for r in rules:
            rules_data.append((str(r.id), r.name, r.condition_expression, list(r.actions)))
    context = _event_context(event)
    for rule_id, rule_name, condition_expression, actions in rules_data:
        if not _evaluate_condition(condition_expression, context):
            continue
        try:
            _execute_actions(rule_id, rule_name, actions, context)
        except Exception:
            logger.exception(
                "workflow_rule_actions_failed",
                rule_id=rule_id,
                rule_name=rule_name,
            )


async def on_artifact_created_workflow_rules(event: DomainEvent) -> None:
    """Run workflow rules for artifact_created."""
    if not isinstance(event, ArtifactCreated):
        return
    await _run_rules_for_trigger(str(event.project_id), TRIGGER_ARTIFACT_CREATED, event)


async def on_artifact_state_changed_workflow_rules(event: DomainEvent) -> None:
    """Run workflow rules for artifact_state_changed."""
    if not isinstance(event, ArtifactStateChanged):
        return
    await _run_rules_for_trigger(str(event.project_id), TRIGGER_ARTIFACT_STATE_CHANGED, event)
