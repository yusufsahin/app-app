"""Create workflow rule."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.project.domain.ports import ProjectRepository
from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.workflow_rule.application.dtos import WorkflowRuleDTO
from alm.workflow_rule.domain.entities import TRIGGER_EVENT_TYPES, WorkflowRule
from alm.workflow_rule.domain.ports import WorkflowRuleRepository


@dataclass(frozen=True)
class CreateWorkflowRule(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    trigger_event_type: str
    actions: list[dict[str, Any]]
    condition_expression: str | None = None
    is_active: bool = True


class CreateWorkflowRuleHandler(CommandHandler[WorkflowRuleDTO]):
    def __init__(
        self,
        workflow_rule_repo: WorkflowRuleRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._workflow_rule_repo = workflow_rule_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> WorkflowRuleDTO:
        assert isinstance(command, CreateWorkflowRule)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        name = (command.name or "").strip()
        if not name:
            raise ValidationError("Name is required")

        trigger = (command.trigger_event_type or "").strip()
        if trigger not in TRIGGER_EVENT_TYPES:
            raise ValidationError(f"trigger_event_type must be one of {TRIGGER_EVENT_TYPES}")

        if not isinstance(command.actions, list):
            raise ValidationError("actions must be a list")

        rule = WorkflowRule.create(
            project_id=command.project_id,
            name=name,
            trigger_event_type=trigger,
            actions=command.actions,
            condition_expression=(command.condition_expression.strip() or None)
            if command.condition_expression
            else None,
            is_active=command.is_active,
        )
        await self._workflow_rule_repo.add(rule)

        return WorkflowRuleDTO(
            id=rule.id,
            project_id=rule.project_id,
            name=rule.name,
            trigger_event_type=rule.trigger_event_type,
            condition_expression=rule.condition_expression,
            actions=rule.actions,
            is_active=rule.is_active,
            created_at=None,
            updated_at=None,
        )
