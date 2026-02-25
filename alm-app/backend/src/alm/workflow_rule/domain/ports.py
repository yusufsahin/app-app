"""WorkflowRule repository port."""
from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.workflow_rule.domain.entities import WorkflowRule


class WorkflowRuleRepository:
    @abstractmethod
    async def find_by_id(self, rule_id: uuid.UUID) -> WorkflowRule | None:
        ...

    @abstractmethod
    async def list_by_project(self, project_id: uuid.UUID) -> list[WorkflowRule]:
        ...

    @abstractmethod
    async def list_active_by_trigger(self, project_id: uuid.UUID, trigger_event_type: str) -> list[WorkflowRule]:
        """List active rules for a project and event type (for execution)."""
        ...

    @abstractmethod
    async def add(self, rule: WorkflowRule) -> WorkflowRule:
        ...

    @abstractmethod
    async def update(self, rule: WorkflowRule) -> WorkflowRule:
        ...

    @abstractmethod
    async def delete(self, rule_id: uuid.UUID) -> bool:
        ...
