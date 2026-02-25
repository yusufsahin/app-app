"""Delete workflow rule."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.workflow_rule.domain.ports import WorkflowRuleRepository


@dataclass(frozen=True)
class DeleteWorkflowRule(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    rule_id: uuid.UUID


class DeleteWorkflowRuleHandler(CommandHandler[bool]):
    def __init__(self, workflow_rule_repo: WorkflowRuleRepository) -> None:
        self._workflow_rule_repo = workflow_rule_repo

    async def handle(self, command: Command) -> bool:
        assert isinstance(command, DeleteWorkflowRule)

        rule = await self._workflow_rule_repo.find_by_id(command.rule_id)
        if rule is None or rule.project_id != command.project_id:
            raise ValidationError("Workflow rule not found")

        return await self._workflow_rule_repo.delete(command.rule_id)
