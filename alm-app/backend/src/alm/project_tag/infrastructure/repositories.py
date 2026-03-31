"""SQLAlchemy implementation of project tag repository."""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.artifact.infrastructure.models import ArtifactModel
from alm.project_tag.application.dtos import ProjectTagDTO
from alm.project_tag.domain.ports import ProjectTagRepository
from alm.project_tag.infrastructure.models import ArtifactTagModel, ProjectTagModel, TaskTagModel
from alm.task.infrastructure.models import TaskModel


def _normalize_tag_name(name: str) -> str:
    s = (name or "").strip()
    if not s:
        raise ValueError("Tag name is required")
    if len(s) > 128:
        raise ValueError("Tag name must be at most 128 characters")
    return s


class SqlAlchemyProjectTagRepository(ProjectTagRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_project(self, project_id: uuid.UUID) -> list[ProjectTagDTO]:
        result = await self._session.execute(
            select(ProjectTagModel)
            .where(ProjectTagModel.project_id == project_id)
            .order_by(func.lower(ProjectTagModel.name))
        )
        rows = result.scalars().all()
        return [self._to_dto(m) for m in rows]

    async def find_by_id(self, project_id: uuid.UUID, tag_id: uuid.UUID) -> ProjectTagDTO | None:
        result = await self._session.execute(
            select(ProjectTagModel).where(
                ProjectTagModel.project_id == project_id,
                ProjectTagModel.id == tag_id,
            )
        )
        m = result.scalar_one_or_none()
        return self._to_dto(m) if m else None

    async def create(self, project_id: uuid.UUID, name: str) -> ProjectTagDTO:
        norm = _normalize_tag_name(name)
        m = ProjectTagModel(id=uuid.uuid4(), project_id=project_id, name=norm)
        self._session.add(m)
        await self._session.flush()
        await self._session.refresh(m)
        return self._to_dto(m)

    async def rename(self, project_id: uuid.UUID, tag_id: uuid.UUID, new_name: str) -> bool:
        norm = _normalize_tag_name(new_name)
        result = await self._session.execute(
            select(ProjectTagModel).where(
                ProjectTagModel.project_id == project_id,
                ProjectTagModel.id == tag_id,
            )
        )
        m = result.scalar_one_or_none()
        if m is None:
            return False
        m.name = norm
        await self._session.flush()
        return True

    async def delete(self, project_id: uuid.UUID, tag_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(ProjectTagModel).where(
                ProjectTagModel.project_id == project_id,
                ProjectTagModel.id == tag_id,
            )
        )
        m = result.scalar_one_or_none()
        if m is None:
            return False
        await self._session.delete(m)
        await self._session.flush()
        return True

    async def validate_tag_ids_for_project(self, project_id: uuid.UUID, tag_ids: list[uuid.UUID]) -> bool:
        if not tag_ids:
            return True
        uniq = list(dict.fromkeys(tag_ids))
        result = await self._session.execute(
            select(func.count(ProjectTagModel.id)).where(
                ProjectTagModel.project_id == project_id,
                ProjectTagModel.id.in_(uniq),
            )
        )
        n = result.scalar_one() or 0
        return int(n) == len(uniq)

    async def set_artifact_tags(self, artifact_id: uuid.UUID, project_id: uuid.UUID, tag_ids: list[uuid.UUID]) -> None:
        ares = await self._session.execute(
            select(ArtifactModel.id).where(
                ArtifactModel.id == artifact_id,
                ArtifactModel.project_id == project_id,
                ArtifactModel.deleted_at.is_(None),
            )
        )
        if ares.scalar_one_or_none() is None:
            raise ValueError("Artifact not found in project")

        if not await self.validate_tag_ids_for_project(project_id, tag_ids):
            raise ValueError("One or more tags are invalid for this project")

        await self._session.execute(delete(ArtifactTagModel).where(ArtifactTagModel.artifact_id == artifact_id))
        for tid in tag_ids:
            self._session.add(ArtifactTagModel(artifact_id=artifact_id, tag_id=tid))
        await self._session.flush()

    async def get_tags_by_artifact_ids(
        self, artifact_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[ProjectTagDTO, ...]]:
        if not artifact_ids:
            return {}
        result = await self._session.execute(
            select(ArtifactTagModel.artifact_id, ProjectTagModel)
            .join(ProjectTagModel, ProjectTagModel.id == ArtifactTagModel.tag_id)
            .where(ArtifactTagModel.artifact_id.in_(artifact_ids))
            .order_by(ArtifactTagModel.artifact_id, func.lower(ProjectTagModel.name))
        )
        by_art: dict[uuid.UUID, list[ProjectTagDTO]] = defaultdict(list)
        for aid, tm in result.all():
            by_art[aid].append(self._to_dto(tm))
        return {aid: tuple(tags) for aid, tags in by_art.items()}

    async def set_task_tags(self, task_id: uuid.UUID, project_id: uuid.UUID, tag_ids: list[uuid.UUID]) -> None:
        tres = await self._session.execute(
            select(TaskModel.id).where(
                TaskModel.id == task_id,
                TaskModel.project_id == project_id,
                TaskModel.deleted_at.is_(None),
            )
        )
        if tres.scalar_one_or_none() is None:
            raise ValueError("Task not found in project")

        if not await self.validate_tag_ids_for_project(project_id, tag_ids):
            raise ValueError("One or more tags are invalid for this project")

        await self._session.execute(delete(TaskTagModel).where(TaskTagModel.task_id == task_id))
        for tid in tag_ids:
            self._session.add(TaskTagModel(task_id=task_id, tag_id=tid))
        await self._session.flush()

    async def get_tags_by_task_ids(
        self, task_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, tuple[ProjectTagDTO, ...]]:
        if not task_ids:
            return {}
        result = await self._session.execute(
            select(TaskTagModel.task_id, ProjectTagModel)
            .join(ProjectTagModel, ProjectTagModel.id == TaskTagModel.tag_id)
            .where(TaskTagModel.task_id.in_(task_ids))
            .order_by(TaskTagModel.task_id, func.lower(ProjectTagModel.name))
        )
        by_task: dict[uuid.UUID, list[ProjectTagDTO]] = defaultdict(list)
        for tid, tm in result.all():
            by_task[tid].append(self._to_dto(tm))
        return {tid: tuple(tags) for tid, tags in by_task.items()}

    @staticmethod
    def _to_dto(m: ProjectTagModel) -> ProjectTagDTO:
        return ProjectTagDTO(
            id=m.id,
            project_id=m.project_id,
            name=m.name,
            created_at=getattr(m, "created_at", None),
            updated_at=getattr(m, "updated_at", None),
        )
