"""ReportDefinition SQLAlchemy repository."""

from __future__ import annotations

import uuid

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alm.report_definition.domain.entities import ReportDefinition
from alm.report_definition.domain.ports import ReportDefinitionRepository
from alm.report_definition.infrastructure.models import ReportDefinitionModel


class SqlAlchemyReportDefinitionRepository(ReportDefinitionRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, report_id: uuid.UUID) -> ReportDefinition | None:
        result = await self._session.execute(
            select(ReportDefinitionModel).where(ReportDefinitionModel.id == report_id)
        )
        m = result.scalar_one_or_none()
        return self._to_entity(m) if m else None

    async def list_for_project(
        self,
        tenant_id: uuid.UUID,
        project_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
    ) -> list[ReportDefinition]:
        q = select(ReportDefinitionModel).where(
            ReportDefinitionModel.tenant_id == tenant_id,
            ReportDefinitionModel.project_id == project_id,
        )
        q = q.where(
            or_(
                ReportDefinitionModel.visibility == "project",
                ReportDefinitionModel.created_by_id == user_id,
            )
        )
        q = q.order_by(ReportDefinitionModel.updated_at.desc())
        result = await self._session.execute(q)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: ReportDefinition) -> ReportDefinition:
        m = ReportDefinitionModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            project_id=entity.project_id,
            created_by_id=entity.created_by_id,
            forked_from_id=entity.forked_from_id,
            catalog_key=entity.catalog_key,
            name=entity.name,
            description=entity.description,
            visibility=entity.visibility,
            query_kind=entity.query_kind,
            builtin_report_id=entity.builtin_report_id,
            builtin_parameters=entity.builtin_parameters or {},
            sql_text=entity.sql_text,
            sql_bind_overrides=entity.sql_bind_overrides or {},
            chart_spec=entity.chart_spec or {},
            lifecycle_status=entity.lifecycle_status,
            last_validated_at=entity.last_validated_at,
            last_validation_ok=entity.last_validation_ok,
            last_validation_message=entity.last_validation_message,
            published_at=entity.published_at,
        )
        self._session.add(m)
        await self._session.flush()
        return entity

    async def update(self, entity: ReportDefinition) -> ReportDefinition:
        await self._session.execute(
            update(ReportDefinitionModel)
            .where(ReportDefinitionModel.id == entity.id)
            .values(
                name=entity.name,
                description=entity.description,
                visibility=entity.visibility,
                query_kind=entity.query_kind,
                builtin_report_id=entity.builtin_report_id,
                builtin_parameters=entity.builtin_parameters or {},
                sql_text=entity.sql_text,
                sql_bind_overrides=entity.sql_bind_overrides or {},
                chart_spec=entity.chart_spec or {},
                lifecycle_status=entity.lifecycle_status,
                last_validated_at=entity.last_validated_at,
                last_validation_ok=entity.last_validation_ok,
                last_validation_message=entity.last_validation_message,
                published_at=entity.published_at,
            )
        )
        await self._session.flush()
        return entity

    async def delete(self, report_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(ReportDefinitionModel).where(ReportDefinitionModel.id == report_id)
        )
        m = result.scalar_one_or_none()
        if m is None:
            return False
        await self._session.delete(m)
        await self._session.flush()
        return True

    @staticmethod
    def _to_entity(m: ReportDefinitionModel) -> ReportDefinition:
        return ReportDefinition(
            id=m.id,
            tenant_id=m.tenant_id,
            project_id=m.project_id,
            created_by_id=m.created_by_id,
            forked_from_id=m.forked_from_id,
            catalog_key=m.catalog_key,
            name=m.name,
            description=m.description or "",
            visibility=m.visibility,
            query_kind=m.query_kind,
            builtin_report_id=m.builtin_report_id,
            builtin_parameters=m.builtin_parameters or {},
            sql_text=m.sql_text,
            sql_bind_overrides=m.sql_bind_overrides or {},
            chart_spec=m.chart_spec or {},
            lifecycle_status=m.lifecycle_status,
            last_validated_at=m.last_validated_at,
            last_validation_ok=m.last_validation_ok,
            last_validation_message=m.last_validation_message,
            published_at=m.published_at,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
