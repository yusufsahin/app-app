"""Process template SQLAlchemy repository."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.process_template.domain.entities import ProcessTemplate, ProcessTemplateVersion
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.process_template.infrastructure.models import (
    ProcessTemplateModel,
    ProcessTemplateVersionModel,
)


class SqlAlchemyProcessTemplateRepository(ProcessTemplateRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_all(self) -> list[ProcessTemplate]:
        result = await self._session.execute(
            select(ProcessTemplateModel).order_by(ProcessTemplateModel.name)
        )
        models = result.scalars().all()
        return [self._to_entity(m) for m in models]

    async def find_by_id(self, template_id: uuid.UUID) -> ProcessTemplate | None:
        result = await self._session.execute(
            select(ProcessTemplateModel).where(ProcessTemplateModel.id == template_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_version_by_id(
        self, version_id: uuid.UUID
    ) -> ProcessTemplateVersion | None:
        result = await self._session.execute(
            select(ProcessTemplateVersionModel).where(
                ProcessTemplateVersionModel.id == version_id
            )
        )
        model = result.scalar_one_or_none()
        return self._to_version_entity(model) if model else None

    async def find_default_version(self) -> ProcessTemplateVersion | None:
        result = await self._session.execute(
            select(ProcessTemplateVersionModel)
            .join(
                ProcessTemplateModel,
                ProcessTemplateVersionModel.template_id == ProcessTemplateModel.id,
            )
            .where(ProcessTemplateModel.slug == "basic")
            .order_by(ProcessTemplateVersionModel.version)
            .limit(1)
        )
        model = result.scalar_one_or_none()
        return self._to_version_entity(model) if model else None

    @staticmethod
    def _to_entity(m: ProcessTemplateModel) -> ProcessTemplate:
        return ProcessTemplate(
            id=m.id,
            slug=m.slug,
            name=m.name,
            is_builtin=m.is_builtin,
        )

    @staticmethod
    def _to_version_entity(m: ProcessTemplateVersionModel) -> ProcessTemplateVersion:
        return ProcessTemplateVersion(
            id=m.id,
            template_id=m.template_id,
            version=m.version,
            manifest_bundle=m.manifest_bundle or {},
        )
