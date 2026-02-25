"""Action runner for on_enter/on_leave hooks. Extensible registry."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

import structlog

logger = structlog.get_logger()

ActionContext = dict[str, Any]  # artifact_id, project_id, from_state, to_state, etc.


def _log_action(name: str, context: ActionContext) -> None:
    logger.info("action_triggered", action=name, **context)


_ACTION_REGISTRY: dict[str, Callable[[ActionContext], None]] = {
    "notify_assignee": lambda ctx: _log_action("notify_assignee", ctx),
    "log_transition": lambda ctx: _log_action("log_transition", ctx),
}


def register_action(name: str, handler: Callable[[ActionContext], None]) -> None:
    """Register an action handler. Extend for custom actions."""
    _ACTION_REGISTRY[name] = handler


def run_actions(
    action_names: list[str],
    *,
    artifact_id: uuid.UUID,
    project_id: uuid.UUID,
    from_state: str,
    to_state: str,
) -> None:
    """Execute actions by name. Unknown actions are logged and skipped."""
    context: ActionContext = {
        "artifact_id": str(artifact_id),
        "project_id": str(project_id),
        "from_state": from_state,
        "to_state": to_state,
    }
    for name in action_names:
        handler = _ACTION_REGISTRY.get(name)
        if handler:
            try:
                handler(context)
            except Exception as e:
                logger.warning("action_failed", action=name, error=str(e))
        else:
            logger.debug("action_not_registered", action=name)
