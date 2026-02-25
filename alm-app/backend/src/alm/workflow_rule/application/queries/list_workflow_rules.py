"""List workflow rules for a project."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.workflow_rule.application.dtos import WorkflowRuleDTO
from alm.workflow_rule.domain.ports import WorkflowRuleRepository


@dataclass(frozen=True)
class ListWorkflowRules(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID


class ListWorkflowRulesHandler(QueryHandler[list[WorkflowRuleDTO]]):
    def __init__(self, workflow_rule_repo: WorkflowRuleRepository) -> None:
        self._workflow_rule_repo = workflow_rule_repo

    async def handle(self, query: Query) -> list[WorkflowRuleDTO]:
        assert isinstance(query, ListWorkflowRules)

        rules = await self._workflow_rule_repo.list_by_project(query.project_id)
        return [
            WorkflowRuleDTO(
                id=r.id,
                project_id=r.project_id,
                name=r.name,
                trigger_event_type=r.trigger_event_type,
                condition_expression=r.condition_expression,
                actions=r.actions,
                is_active=r.is_active,
                created_at=r.created_at.isoformat() if r.created_at else None,
                updated_at=r.updated_at.isoformat() if r.updated_at else None,
            )
            for r in rules
        ]
