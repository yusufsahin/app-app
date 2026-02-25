"""Task SQLAlchemy repository."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.task.domain.entities import Task
from alm.task.domain.ports import TaskRepository
from alm.task.infrastructure.models import TaskModel


class SqlAlchemyTaskRepository(TaskRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, task_id: uuid.UUID) -> Task | None:
        result = await self._session.execute(
            select(TaskModel).where(
                TaskModel.id == task_id,
                TaskModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_artifact(
        self,
        artifact_id: uuid.UUID,
        include_deleted: bool = False,
    ) -> list[Task]:
        q = select(TaskModel).where(TaskModel.artifact_id == artifact_id)
        if not include_deleted:
            q = q.where(TaskModel.deleted_at.is_(None))
        q = q.order_by(TaskModel.rank_order.asc().nullslast(), TaskModel.created_at.asc())
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def list_by_project_and_assignee(
        self,
        project_id: uuid.UUID,
        assignee_id: uuid.UUID,
    ) -> list[Task]:
        q = (
            select(TaskModel)
            .where(
                TaskModel.project_id == project_id,
                TaskModel.assignee_id == assignee_id,
                TaskModel.deleted_at.is_(None),
            )
            .order_by(TaskModel.rank_order.asc().nullslast(), TaskModel.created_at.asc())
        )
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def count_by_project_ids(self, project_ids: list[uuid.UUID]) -> int:
        if not project_ids:
            return 0
        result = await self._session.execute(
            select(func.count(TaskModel.id)).where(
                TaskModel.project_id.in_(project_ids),
                TaskModel.deleted_at.is_(None),
            )
        )
        return result.scalar_one() or 0

    async def add(self, task: Task) -> Task:
        model = TaskModel(
            id=task.id,
            project_id=task.project_id,
            artifact_id=task.artifact_id,
            title=task.title,
            state=task.state,
            description=task.description or "",
            assignee_id=task.assignee_id,
            rank_order=task.rank_order,
        )
        self._session.add(model)
        await self._session.flush()
        return task

    async def update(self, task: Task) -> Task:
        await self._session.execute(
            update(TaskModel)
            .where(TaskModel.id == task.id)
            .values(
                title=task.title,
                state=task.state,
                description=task.description or "",
                assignee_id=task.assignee_id,
                rank_order=task.rank_order,
            )
        )
        await self._session.flush()
        return task

    async def soft_delete(
        self,
        task_id: uuid.UUID,
        deleted_by: uuid.UUID | None = None,
    ) -> bool:
        result = await self._session.execute(
            update(TaskModel)
            .where(TaskModel.id == task_id, TaskModel.deleted_at.is_(None))
            .values(
                deleted_at=datetime.now(UTC),
                deleted_by=deleted_by,
            )
        )
        await self._session.flush()
        return bool(getattr(result, "rowcount", 0))

    @staticmethod
    def _to_entity(m: TaskModel) -> Task:
        return Task(
            id=m.id,
            project_id=m.project_id,
            artifact_id=m.artifact_id,
            title=m.title,
            state=m.state,
            description=m.description or "",
            assignee_id=m.assignee_id,
            rank_order=m.rank_order,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
