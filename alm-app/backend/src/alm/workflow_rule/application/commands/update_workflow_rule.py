"""Update workflow rule."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.workflow_rule.application.dtos import WorkflowRuleDTO
from alm.workflow_rule.domain.entities import WorkflowRule, TRIGGER_EVENT_TYPES
from alm.workflow_rule.domain.ports import WorkflowRuleRepository


@dataclass(frozen=True)
class UpdateWorkflowRule(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    rule_id: uuid.UUID
    name: str | None = None
    trigger_event_type: str | None = None
    condition_expression: str | None = None
    actions: list[dict] | None = None
    is_active: bool | None = None


class UpdateWorkflowRuleHandler(CommandHandler[WorkflowRuleDTO]):
    def __init__(self, workflow_rule_repo: WorkflowRuleRepository) -> None:
        self._workflow_rule_repo = workflow_rule_repo

    async def handle(self, command: Command) -> WorkflowRuleDTO:
        assert isinstance(command, UpdateWorkflowRule)

        existing = await self._workflow_rule_repo.find_by_id(command.rule_id)
        if existing is None or existing.project_id != command.project_id:
            raise ValidationError("Workflow rule not found")

        name = existing.name
        if command.name is not None:
            n = (command.name or "").strip()
            if n:
                name = n

        trigger = existing.trigger_event_type
        if command.trigger_event_type is not None:
            t = (command.trigger_event_type or "").strip()
            if t in TRIGGER_EVENT_TYPES:
                trigger = t

        condition = existing.condition_expression
        if command.condition_expression is not None:
            condition = (command.condition_expression.strip() or None) if command.condition_expression else None

        actions = existing.actions
        if command.actions is not None:
            if isinstance(command.actions, list):
                actions = command.actions

        is_active = existing.is_active
        if command.is_active is not None:
            is_active = command.is_active

        updated = WorkflowRule(
            id=existing.id,
            project_id=existing.project_id,
            name=name,
            trigger_event_type=trigger,
            condition_expression=condition,
            actions=actions,
            is_active=is_active,
        )
        await self._workflow_rule_repo.update(updated)

        refetched = await self._workflow_rule_repo.find_by_id(command.rule_id) or updated
        return WorkflowRuleDTO(
            id=refetched.id,
            project_id=refetched.project_id,
            name=refetched.name,
            trigger_event_type=refetched.trigger_event_type,
            condition_expression=refetched.condition_expression,
            actions=refetched.actions,
            is_active=refetched.is_active,
            created_at=refetched.created_at.isoformat() if refetched.created_at else None,
            updated_at=refetched.updated_at.isoformat() if refetched.updated_at else None,
        )
