"""Infrastructure implementation of workflow rule execution (uses DB session)."""

from __future__ import annotations

import uuid
from typing import Any

import structlog

from alm.artifact.domain.events import ArtifactCreated, ArtifactStateChanged
from alm.shared.domain.events import DomainEvent
from alm.shared.infrastructure.db.session import async_session_factory
from alm.workflow_rule.domain.ports import IWorkflowRuleRunner
from alm.workflow_rule.infrastructure.repositories import SqlAlchemyWorkflowRuleRepository

logger = structlog.get_logger()


def _event_context(event: DomainEvent) -> dict[str, Any]:
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


def _evaluate_condition(condition_expression: str | None, context: dict[str, Any]) -> bool:
    if not condition_expression or not condition_expression.strip():
        return True
    return True


def _execute_actions(
    rule_id: str, rule_name: str, actions: list[dict[str, Any]], context: dict[str, Any]
) -> None:
    for _, action in enumerate(actions):
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


class WorkflowRuleRunner(IWorkflowRuleRunner):
    """Runs workflow rules for a project/trigger; uses its own session (infrastructure)."""

    async def run(
        self,
        project_id: uuid.UUID,
        trigger_event_type: str,
        event: DomainEvent,
    ) -> None:
        rules_data: list[tuple[str, str, str | None, list[dict[str, Any]]]] = []
        async with async_session_factory() as session:
            repo = SqlAlchemyWorkflowRuleRepository(session)
            rules = await repo.list_active_by_trigger(project_id, trigger_event_type)
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
