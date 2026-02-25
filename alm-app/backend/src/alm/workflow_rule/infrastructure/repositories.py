"""WorkflowRule SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.workflow_rule.domain.entities import WorkflowRule
from alm.workflow_rule.domain.ports import WorkflowRuleRepository
from alm.workflow_rule.infrastructure.models import WorkflowRuleModel


class SqlAlchemyWorkflowRuleRepository(WorkflowRuleRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, rule_id: uuid.UUID) -> WorkflowRule | None:
        result = await self._session.execute(select(WorkflowRuleModel).where(WorkflowRuleModel.id == rule_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_project(self, project_id: uuid.UUID) -> list[WorkflowRule]:
        result = await self._session.execute(
            select(WorkflowRuleModel).where(WorkflowRuleModel.project_id == project_id).order_by(WorkflowRuleModel.name)
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_active_by_trigger(self, project_id: uuid.UUID, trigger_event_type: str) -> list[WorkflowRule]:
        result = await self._session.execute(
            select(WorkflowRuleModel).where(
                WorkflowRuleModel.project_id == project_id,
                WorkflowRuleModel.trigger_event_type == trigger_event_type,
                WorkflowRuleModel.is_active.is_(True),
            )
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, rule: WorkflowRule) -> WorkflowRule:
        model = WorkflowRuleModel(
            id=rule.id,
            project_id=rule.project_id,
            name=rule.name,
            trigger_event_type=rule.trigger_event_type,
            condition_expression=rule.condition_expression,
            actions=rule.actions,
            is_active=rule.is_active,
        )
        self._session.add(model)
        await self._session.flush()
        return rule

    async def update(self, rule: WorkflowRule) -> WorkflowRule:
        from sqlalchemy import update

        await self._session.execute(
            update(WorkflowRuleModel)
            .where(WorkflowRuleModel.id == rule.id)
            .values(
                name=rule.name,
                trigger_event_type=rule.trigger_event_type,
                condition_expression=rule.condition_expression,
                actions=rule.actions,
                is_active=rule.is_active,
            )
        )
        await self._session.flush()
        return rule

    async def delete(self, rule_id: uuid.UUID) -> bool:
        result = await self._session.execute(select(WorkflowRuleModel).where(WorkflowRuleModel.id == rule_id))
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    @staticmethod
    def _to_entity(m: WorkflowRuleModel) -> WorkflowRule:
        return WorkflowRule(
            id=m.id,
            project_id=m.project_id,
            name=m.name,
            trigger_event_type=m.trigger_event_type,
            condition_expression=m.condition_expression,
            actions=m.actions if m.actions is not None else [],
            is_active=m.is_active,
            created_at=getattr(m, "created_at", None),
            updated_at=getattr(m, "updated_at", None),
        )
