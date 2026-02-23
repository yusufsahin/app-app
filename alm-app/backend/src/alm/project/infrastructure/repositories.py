from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.shared.application.mediator import buffer_events
from alm.shared.audit.core import ChangeType
from alm.shared.audit.interceptor import buffer_audit
from alm.project.domain.entities import Project
from alm.project.domain.ports import ProjectRepository
from alm.project.infrastructure.models import ProjectModel


class SqlAlchemyProjectRepository(ProjectRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, project_id: uuid.UUID) -> Project | None:
        result = await self._session.execute(
            select(ProjectModel).where(
                ProjectModel.id == project_id,
                ProjectModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_tenant_and_slug(
        self, tenant_id: uuid.UUID, slug: str
    ) -> Project | None:
        result = await self._session.execute(
            select(ProjectModel).where(
                ProjectModel.tenant_id == tenant_id,
                ProjectModel.slug == slug,
                ProjectModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_tenant_and_code(
        self, tenant_id: uuid.UUID, code: str
    ) -> Project | None:
        result = await self._session.execute(
            select(ProjectModel).where(
                ProjectModel.tenant_id == tenant_id,
                ProjectModel.code == code.upper(),
                ProjectModel.deleted_at.is_(None),
            )
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list_by_tenant(self, tenant_id: uuid.UUID) -> list[Project]:
        result = await self._session.execute(
            select(ProjectModel).where(
                ProjectModel.tenant_id == tenant_id,
                ProjectModel.deleted_at.is_(None),
            ).order_by(ProjectModel.name)
        )
        models = result.scalars().all()
        return [self._to_entity(m) for m in models]

    async def add(self, project: Project) -> Project:
        model = ProjectModel(
            id=project.id,
            tenant_id=project.tenant_id,
            code=project.code,
            name=project.name,
            slug=project.slug,
            description=project.description,
            process_template_version_id=project.process_template_version_id,
        )
        self._session.add(model)
        await self._session.flush()
        buffer_events(self._session, project.collect_events())
        buffer_audit(
            self._session,
            "Project",
            project.id,
            project.to_snapshot_dict(),
            ChangeType.INITIAL,
        )
        return project

    @staticmethod
    def _to_entity(m: ProjectModel) -> Project:
        p = Project(
            tenant_id=m.tenant_id,
            name=m.name,
            slug=m.slug,
            code=m.code,
            description=m.description,
            id=m.id,
            process_template_version_id=m.process_template_version_id,
        )
        p.created_at = m.created_at
        p.created_by = m.created_by
        p.updated_at = m.updated_at
        p.updated_by = m.updated_by
        p.deleted_at = m.deleted_at
        p.deleted_by = m.deleted_by
        return p
