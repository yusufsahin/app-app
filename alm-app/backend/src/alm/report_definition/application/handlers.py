"""Commands and queries for stored report definitions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from alm.project.domain.ports import ProjectRepository
from alm.report_definition.application.catalog import REPORT_TEMPLATE_CATALOG
from alm.report_definition.application.commands import (
    CreateReportDefinition,
    DeleteReportDefinition,
    ForkReportDefinition,
    ForkReportFromCatalog,
    PublishReportDefinition,
    UpdateReportDefinition,
    ValidateReportDefinition,
)
from alm.report_definition.application.dtos import ReportDefinitionDTO
from alm.report_definition.application.execution import run_stored_report
from alm.report_definition.application.queries import (
    ExecuteStoredReport,
    GetReportDefinition,
    ListReportDefinitions,
)
from alm.report_definition.domain.entities import ReportDefinition
from alm.report_definition.domain.ports import ReportDefinitionRepository
from alm.reporting.application.builtin import is_registered_report_id
from alm.reporting.application.sql_guard import validate_report_sql
from alm.shared.application.command import Command, CommandHandler
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import EntityNotFound, ValidationError


def _to_dto(e: ReportDefinition) -> ReportDefinitionDTO:
    return ReportDefinitionDTO(
        id=e.id,
        tenant_id=e.tenant_id,
        project_id=e.project_id,
        created_by_id=e.created_by_id,
        forked_from_id=e.forked_from_id,
        catalog_key=e.catalog_key,
        name=e.name,
        description=e.description,
        visibility=e.visibility,
        query_kind=e.query_kind,
        builtin_report_id=e.builtin_report_id,
        builtin_parameters=e.builtin_parameters or {},
        sql_text=e.sql_text,
        sql_bind_overrides=e.sql_bind_overrides or {},
        chart_spec=e.chart_spec or {},
        lifecycle_status=e.lifecycle_status,
        last_validated_at=e.last_validated_at.isoformat() if e.last_validated_at else None,
        last_validation_ok=e.last_validation_ok,
        last_validation_message=e.last_validation_message,
        published_at=e.published_at.isoformat() if e.published_at else None,
        created_at=e.created_at.isoformat() if e.created_at else None,
        updated_at=e.updated_at.isoformat() if e.updated_at else None,
    )


async def _ensure_project(project_repo: ProjectRepository, tenant_id: uuid.UUID, project_id: uuid.UUID) -> None:
    p = await project_repo.find_by_id(project_id)
    if p is None or p.tenant_id != tenant_id:
        raise ValidationError("Project not found")


def _can_read(definition: ReportDefinition, user_id: uuid.UUID) -> bool:
    if definition.visibility == "project":
        return True
    return definition.created_by_id == user_id


async def _get_visible(
    repo: ReportDefinitionRepository,
    *,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ReportDefinition:
    e = await repo.find_by_id(report_id)
    if e is None or e.tenant_id != tenant_id or e.project_id != project_id:
        raise EntityNotFound("ReportDefinition", report_id)
    if not _can_read(e, user_id):
        raise EntityNotFound("ReportDefinition", report_id)
    return e


class CreateReportDefinitionHandler(CommandHandler[ReportDefinitionDTO]):
    def __init__(
        self,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ReportDefinitionDTO:
        assert isinstance(command, CreateReportDefinition)
        await _ensure_project(self._project_repo, command.tenant_id, command.project_id)

        name = (command.name or "").strip()
        if not name:
            raise ValidationError("Name is required")

        qk = (command.query_kind or "sql").strip().lower()
        if qk not in ("builtin", "sql"):
            raise ValidationError("query_kind must be builtin or sql")

        visibility = (command.visibility or "private").strip().lower()
        if visibility not in ("private", "project"):
            visibility = "private"

        builtin_report_id = command.builtin_report_id
        sql_text = command.sql_text
        builtin_parameters = dict(command.builtin_parameters or {})

        if qk == "builtin":
            if not builtin_report_id or not is_registered_report_id(builtin_report_id):
                raise ValidationError("Invalid or missing builtin_report_id")
            sql_text = None
        else:
            builtin_report_id = None
            builtin_parameters = {}
            if not sql_text or not sql_text.strip():
                raise ValidationError("sql_text is required for SQL reports")
            validate_report_sql(sql_text, require_project_scope=True)

        entity = ReportDefinition(
            id=uuid.uuid4(),
            tenant_id=command.tenant_id,
            project_id=command.project_id,
            created_by_id=command.user_id,
            forked_from_id=None,
            catalog_key=command.catalog_key,
            name=name,
            description=(command.description or "").strip(),
            visibility=visibility,
            query_kind=qk,
            builtin_report_id=builtin_report_id,
            builtin_parameters=builtin_parameters,
            sql_text=sql_text.strip() if sql_text else None,
            sql_bind_overrides=dict(command.sql_bind_overrides or {}),
            chart_spec=dict(command.chart_spec or {}),
            lifecycle_status="draft",
            last_validated_at=None,
            last_validation_ok=False,
            last_validation_message=None,
            published_at=None,
            created_at=None,
            updated_at=None,
        )
        await self._report_repo.add(entity)
        saved = await self._report_repo.find_by_id(entity.id) or entity
        return _to_dto(saved)


class UpdateReportDefinitionHandler(CommandHandler[ReportDefinitionDTO]):
    def __init__(
        self,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ReportDefinitionDTO:
        assert isinstance(command, UpdateReportDefinition)
        await _ensure_project(self._project_repo, command.tenant_id, command.project_id)
        e = await _get_visible(
            self._report_repo,
            tenant_id=command.tenant_id,
            project_id=command.project_id,
            report_id=command.report_id,
            user_id=command.user_id,
        )
        if e.created_by_id != command.user_id:
            raise ValidationError("Only the owner can update this report")

        reset_validation = False
        name = e.name
        if command.name is not None:
            n = command.name.strip()
            if n:
                name = n
        description = e.description
        if command.description is not None:
            description = command.description.strip()
        visibility = e.visibility
        if command.visibility is not None:
            vis = command.visibility.strip().lower()
            if vis in ("private", "project"):
                visibility = vis
        builtin_parameters = dict(e.builtin_parameters or {})
        if command.builtin_parameters is not None:
            builtin_parameters = dict(command.builtin_parameters)
            reset_validation = True
        sql_text = e.sql_text
        if command.sql_text is not None:
            if e.query_kind != "sql":
                raise ValidationError("Cannot set sql_text on builtin reports")
            validate_report_sql(command.sql_text, require_project_scope=True)
            sql_text = command.sql_text.strip()
            reset_validation = True
        sql_bind_overrides = dict(e.sql_bind_overrides or {})
        if command.sql_bind_overrides is not None:
            sql_bind_overrides = dict(command.sql_bind_overrides)
            reset_validation = True
        chart_spec = dict(e.chart_spec or {})
        if command.chart_spec is not None:
            chart_spec = dict(command.chart_spec)
            reset_validation = True

        new_lifecycle = e.lifecycle_status
        new_published = e.published_at
        new_last_ok = e.last_validation_ok
        new_last_at = e.last_validated_at
        new_last_msg = e.last_validation_message
        if reset_validation:
            new_lifecycle = "draft"
            new_published = None
            new_last_ok = False
            new_last_at = None
            new_last_msg = None

        updated = ReportDefinition(
            id=e.id,
            tenant_id=e.tenant_id,
            project_id=e.project_id,
            created_by_id=e.created_by_id,
            forked_from_id=e.forked_from_id,
            catalog_key=e.catalog_key,
            name=name,
            description=description,
            visibility=visibility,
            query_kind=e.query_kind,
            builtin_report_id=e.builtin_report_id,
            builtin_parameters=builtin_parameters,
            sql_text=sql_text,
            sql_bind_overrides=sql_bind_overrides,
            chart_spec=chart_spec,
            lifecycle_status=new_lifecycle,
            last_validated_at=new_last_at,
            last_validation_ok=new_last_ok,
            last_validation_message=new_last_msg,
            published_at=new_published,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        await self._report_repo.update(updated)
        out = await self._report_repo.find_by_id(command.report_id) or updated
        return _to_dto(out)


class DeleteReportDefinitionHandler(CommandHandler[bool]):
    def __init__(
        self,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> bool:
        assert isinstance(command, DeleteReportDefinition)
        await _ensure_project(self._project_repo, command.tenant_id, command.project_id)
        e = await _get_visible(
            self._report_repo,
            tenant_id=command.tenant_id,
            project_id=command.project_id,
            report_id=command.report_id,
            user_id=command.user_id,
        )
        if e.created_by_id != command.user_id:
            raise ValidationError("Only the owner can delete this report")
        return await self._report_repo.delete(command.report_id)


class ForkReportDefinitionHandler(CommandHandler[ReportDefinitionDTO]):
    def __init__(
        self,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ReportDefinitionDTO:
        assert isinstance(command, ForkReportDefinition)
        await _ensure_project(self._project_repo, command.tenant_id, command.project_id)
        src = await _get_visible(
            self._report_repo,
            tenant_id=command.tenant_id,
            project_id=command.project_id,
            report_id=command.source_report_id,
            user_id=command.user_id,
        )
        new_name = (command.name or "").strip() or f"{src.name} (copy)"
        forked = ReportDefinition(
            id=uuid.uuid4(),
            tenant_id=command.tenant_id,
            project_id=command.project_id,
            created_by_id=command.user_id,
            forked_from_id=src.id,
            catalog_key=None,
            name=new_name,
            description=src.description,
            visibility="private",
            query_kind=src.query_kind,
            builtin_report_id=src.builtin_report_id,
            builtin_parameters=dict(src.builtin_parameters or {}),
            sql_text=src.sql_text,
            sql_bind_overrides=dict(src.sql_bind_overrides or {}),
            chart_spec=dict(src.chart_spec or {}),
            lifecycle_status="draft",
            last_validated_at=None,
            last_validation_ok=False,
            last_validation_message=None,
            published_at=None,
            created_at=None,
            updated_at=None,
        )
        await self._report_repo.add(forked)
        saved = await self._report_repo.find_by_id(forked.id) or forked
        return _to_dto(saved)


class ForkReportFromCatalogHandler(CommandHandler[ReportDefinitionDTO]):
    def __init__(
        self,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ReportDefinitionDTO:
        assert isinstance(command, ForkReportFromCatalog)
        await _ensure_project(self._project_repo, command.tenant_id, command.project_id)
        key = (command.catalog_key or "").strip()
        entry = REPORT_TEMPLATE_CATALOG.get(key)
        if entry is None:
            raise ValidationError("Unknown catalog_key")

        qk = entry["query_kind"]
        new_name = (command.name or "").strip() or entry.get("name", key)

        builtin_report_id = entry.get("builtin_report_id")
        sql_text = entry.get("sql_text")
        builtin_parameters = dict(entry.get("builtin_parameters") or {})

        if qk == "builtin":
            if not builtin_report_id or not is_registered_report_id(builtin_report_id):
                raise ValidationError("Invalid builtin template")
            sql_text = None
        else:
            builtin_report_id = None
            builtin_parameters = {}
            if sql_text:
                validate_report_sql(sql_text, require_project_scope=True)

        entity = ReportDefinition(
            id=uuid.uuid4(),
            tenant_id=command.tenant_id,
            project_id=command.project_id,
            created_by_id=command.user_id,
            forked_from_id=None,
            catalog_key=key,
            name=new_name,
            description=(entry.get("description") or "").strip(),
            visibility="private",
            query_kind=qk,
            builtin_report_id=builtin_report_id,
            builtin_parameters=builtin_parameters,
            sql_text=sql_text.strip() if sql_text else None,
            sql_bind_overrides={},
            chart_spec=dict(entry.get("chart_spec") or {}),
            lifecycle_status="draft",
            last_validated_at=None,
            last_validation_ok=False,
            last_validation_message=None,
            published_at=None,
            created_at=None,
            updated_at=None,
        )
        await self._report_repo.add(entity)
        saved = await self._report_repo.find_by_id(entity.id) or entity
        return _to_dto(saved)


class ValidateReportDefinitionHandler(CommandHandler[ReportDefinitionDTO]):
    def __init__(
        self,
        session: AsyncSession,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._session = session
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ReportDefinitionDTO:
        assert isinstance(command, ValidateReportDefinition)
        await _ensure_project(self._project_repo, command.tenant_id, command.project_id)
        e = await _get_visible(
            self._report_repo,
            tenant_id=command.tenant_id,
            project_id=command.project_id,
            report_id=command.report_id,
            user_id=command.user_id,
        )
        if e.created_by_id != command.user_id:
            raise ValidationError("Only the owner can validate this report")

        now = datetime.now(UTC)
        try:
            result = await run_stored_report(
                session=self._session,
                mediator=command.mediator,
                definition=e,
                tenant_id=command.tenant_id,
                project_id=command.project_id,
                row_limit=5000,
            )
            nrows = len(result.get("rows") or [])
            msg = f"OK: {nrows} row(s) returned"
            updated = ReportDefinition(
                id=e.id,
                tenant_id=e.tenant_id,
                project_id=e.project_id,
                created_by_id=e.created_by_id,
                forked_from_id=e.forked_from_id,
                catalog_key=e.catalog_key,
                name=e.name,
                description=e.description,
                visibility=e.visibility,
                query_kind=e.query_kind,
                builtin_report_id=e.builtin_report_id,
                builtin_parameters=e.builtin_parameters or {},
                sql_text=e.sql_text,
                sql_bind_overrides=e.sql_bind_overrides or {},
                chart_spec=e.chart_spec or {},
                lifecycle_status=e.lifecycle_status,
                last_validated_at=now,
                last_validation_ok=True,
                last_validation_message=msg,
                published_at=e.published_at,
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
        except ValidationError as exc:
            updated = ReportDefinition(
                id=e.id,
                tenant_id=e.tenant_id,
                project_id=e.project_id,
                created_by_id=e.created_by_id,
                forked_from_id=e.forked_from_id,
                catalog_key=e.catalog_key,
                name=e.name,
                description=e.description,
                visibility=e.visibility,
                query_kind=e.query_kind,
                builtin_report_id=e.builtin_report_id,
                builtin_parameters=e.builtin_parameters or {},
                sql_text=e.sql_text,
                sql_bind_overrides=e.sql_bind_overrides or {},
                chart_spec=e.chart_spec or {},
                lifecycle_status=e.lifecycle_status,
                last_validated_at=now,
                last_validation_ok=False,
                last_validation_message=str(exc),
                published_at=e.published_at,
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
        await self._report_repo.update(updated)
        out = await self._report_repo.find_by_id(command.report_id) or updated
        return _to_dto(out)


class PublishReportDefinitionHandler(CommandHandler[ReportDefinitionDTO]):
    def __init__(
        self,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> ReportDefinitionDTO:
        assert isinstance(command, PublishReportDefinition)
        await _ensure_project(self._project_repo, command.tenant_id, command.project_id)
        e = await _get_visible(
            self._report_repo,
            tenant_id=command.tenant_id,
            project_id=command.project_id,
            report_id=command.report_id,
            user_id=command.user_id,
        )
        if e.created_by_id != command.user_id:
            raise ValidationError("Only the owner can publish this report")
        if not e.last_validation_ok:
            raise ValidationError("Run validate successfully before publishing")

        now = datetime.now(UTC)
        updated = ReportDefinition(
            id=e.id,
            tenant_id=e.tenant_id,
            project_id=e.project_id,
            created_by_id=e.created_by_id,
            forked_from_id=e.forked_from_id,
            catalog_key=e.catalog_key,
            name=e.name,
            description=e.description,
            visibility=e.visibility,
            query_kind=e.query_kind,
            builtin_report_id=e.builtin_report_id,
            builtin_parameters=e.builtin_parameters or {},
            sql_text=e.sql_text,
            sql_bind_overrides=e.sql_bind_overrides or {},
            chart_spec=e.chart_spec or {},
            lifecycle_status="published",
            last_validated_at=e.last_validated_at,
            last_validation_ok=e.last_validation_ok,
            last_validation_message=e.last_validation_message,
            published_at=now,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        await self._report_repo.update(updated)
        out = await self._report_repo.find_by_id(command.report_id) or updated
        return _to_dto(out)


class ListReportDefinitionsHandler(QueryHandler[list[ReportDefinitionDTO]]):
    def __init__(
        self,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[ReportDefinitionDTO]:
        assert isinstance(query, ListReportDefinitions)
        await _ensure_project(self._project_repo, query.tenant_id, query.project_id)
        rows = await self._report_repo.list_for_project(
            query.tenant_id, query.project_id, user_id=query.user_id
        )
        return [_to_dto(r) for r in rows]


class GetReportDefinitionHandler(QueryHandler[ReportDefinitionDTO]):
    def __init__(
        self,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> ReportDefinitionDTO:
        assert isinstance(query, GetReportDefinition)
        await _ensure_project(self._project_repo, query.tenant_id, query.project_id)
        e = await _get_visible(
            self._report_repo,
            tenant_id=query.tenant_id,
            project_id=query.project_id,
            report_id=query.report_id,
            user_id=query.user_id,
        )
        return _to_dto(e)


class ExecuteStoredReportHandler(QueryHandler[dict[str, Any]]):
    def __init__(
        self,
        session: AsyncSession,
        report_repo: ReportDefinitionRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._session = session
        self._report_repo = report_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> dict[str, Any]:
        assert isinstance(query, ExecuteStoredReport)
        await _ensure_project(self._project_repo, query.tenant_id, query.project_id)
        e = await _get_visible(
            self._report_repo,
            tenant_id=query.tenant_id,
            project_id=query.project_id,
            report_id=query.report_id,
            user_id=query.user_id,
        )
        if not query.allow_draft and e.lifecycle_status != "published":
            raise ValidationError("Report is not published")
        return await run_stored_report(
            session=self._session,
            mediator=query.mediator,
            definition=e,
            tenant_id=query.tenant_id,
            project_id=query.project_id,
            row_limit=query.row_limit,
        )
