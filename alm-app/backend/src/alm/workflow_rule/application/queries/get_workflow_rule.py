"""Get single workflow rule by id."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.workflow_rule.application.dtos import WorkflowRuleDTO
from alm.workflow_rule.domain.ports import WorkflowRuleRepository


@dataclass(frozen=True)
class GetWorkflowRule(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    rule_id: uuid.UUID


class GetWorkflowRuleHandler(QueryHandler[WorkflowRuleDTO | None]):
    def __init__(self, workflow_rule_repo: WorkflowRuleRepository) -> None:
        self._workflow_rule_repo = workflow_rule_repo

    async def handle(self, query: Query) -> WorkflowRuleDTO | None:
        assert isinstance(query, GetWorkflowRule)

        rule = await self._workflow_rule_repo.find_by_id(query.rule_id)
        if rule is None or rule.project_id != query.project_id:
            return None
        return WorkflowRuleDTO(
            id=rule.id,
            project_id=rule.project_id,
            name=rule.name,
            trigger_event_type=rule.trigger_event_type,
            condition_expression=rule.condition_expression,
            actions=rule.actions,
            is_active=rule.is_active,
            created_at=rule.created_at.isoformat() if rule.created_at else None,
            updated_at=rule.updated_at.isoformat() if rule.updated_at else None,
        )
