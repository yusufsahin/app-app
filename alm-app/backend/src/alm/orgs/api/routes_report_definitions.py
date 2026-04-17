"""Stored report definitions: catalog templates, SQL/builtin, validate → publish, execute for charts."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query

from alm.orgs.api._router_deps import *  # noqa: F403
from alm.report_definition.api.schemas import (
    ReportDefinitionCreateRequest,
    ReportDefinitionForkRequest,
    ReportDefinitionFromCatalogRequest,
    ReportDefinitionResponse,
    ReportDefinitionUpdateRequest,
    ReportTemplateCatalogItemResponse,
    report_definition_dto_to_response,
)
from alm.report_definition.application.catalog import list_catalog_keys
from alm.report_definition.application.commands import (
    CreateReportDefinition,
    DeleteReportDefinition,
    ForkReportDefinition,
    ForkReportFromCatalog,
    PublishReportDefinition,
    UpdateReportDefinition,
    ValidateReportDefinition,
)
from alm.report_definition.application.queries import (
    ExecuteStoredReport,
    GetReportDefinition,
    ListReportDefinitions,
)
from alm.shared.domain.exceptions import EntityNotFound, ValidationError

router = APIRouter()


@router.get(
    "/report-templates/catalog",
    response_model=list[ReportTemplateCatalogItemResponse],
)
async def get_report_template_catalog(
    _org: ResolvedOrg = Depends(resolve_org),
    _: CurrentUser = require_permission("project:read"),
) -> list[ReportTemplateCatalogItemResponse]:
    """Predefined QC-style templates (fork to customize)."""
    return [ReportTemplateCatalogItemResponse(**row) for row in list_catalog_keys()]


@router.get(
    "/projects/{project_id}/report-definitions",
    response_model=list[ReportDefinitionResponse],
)
async def list_report_definitions(
    project_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ReportDefinitionResponse]:
    try:
        dtos = await mediator.query(
            ListReportDefinitions(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
            )
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return [report_definition_dto_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/report-definitions",
    response_model=ReportDefinitionResponse,
    status_code=201,
)
async def create_report_definition(
    project_id: uuid.UUID,
    body: ReportDefinitionCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ReportDefinitionResponse:
    try:
        dto = await mediator.send(
            CreateReportDefinition(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                name=body.name,
                description=body.description,
                visibility=body.visibility,
                query_kind=body.query_kind,
                builtin_report_id=body.builtin_report_id,
                builtin_parameters=body.builtin_parameters,
                sql_text=body.sql_text,
                sql_bind_overrides=body.sql_bind_overrides,
                chart_spec=body.chart_spec,
                catalog_key=body.catalog_key,
            )
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return report_definition_dto_to_response(dto)


@router.post(
    "/projects/{project_id}/report-definitions/from-catalog",
    response_model=ReportDefinitionResponse,
    status_code=201,
)
async def create_report_from_catalog(
    project_id: uuid.UUID,
    body: ReportDefinitionFromCatalogRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ReportDefinitionResponse:
    try:
        dto = await mediator.send(
            ForkReportFromCatalog(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                catalog_key=body.catalog_key,
                name=body.name,
            )
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return report_definition_dto_to_response(dto)


@router.get(
    "/projects/{project_id}/report-definitions/{report_id}",
    response_model=ReportDefinitionResponse,
)
async def get_report_definition(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ReportDefinitionResponse:
    try:
        dto = await mediator.query(
            GetReportDefinition(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                report_id=report_id,
            )
        )
    except EntityNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return report_definition_dto_to_response(dto)


@router.put(
    "/projects/{project_id}/report-definitions/{report_id}",
    response_model=ReportDefinitionResponse,
)
async def update_report_definition(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    body: ReportDefinitionUpdateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ReportDefinitionResponse:
    try:
        dto = await mediator.send(
            UpdateReportDefinition(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                report_id=report_id,
                name=body.name,
                description=body.description,
                visibility=body.visibility,
                builtin_parameters=body.builtin_parameters,
                sql_text=body.sql_text,
                sql_bind_overrides=body.sql_bind_overrides,
                chart_spec=body.chart_spec,
            )
        )
    except EntityNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return report_definition_dto_to_response(dto)


@router.delete("/projects/{project_id}/report-definitions/{report_id}", status_code=204)
async def delete_report_definition(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    try:
        await mediator.send(
            DeleteReportDefinition(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                report_id=report_id,
            )
        )
    except EntityNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/projects/{project_id}/report-definitions/{report_id}/fork",
    response_model=ReportDefinitionResponse,
    status_code=201,
)
async def fork_report_definition(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    body: ReportDefinitionForkRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ReportDefinitionResponse:
    try:
        dto = await mediator.send(
            ForkReportDefinition(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                source_report_id=report_id,
                name=body.name,
            )
        )
    except EntityNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return report_definition_dto_to_response(dto)


@router.post(
    "/projects/{project_id}/report-definitions/{report_id}/validate",
    response_model=ReportDefinitionResponse,
)
async def validate_report_definition(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ReportDefinitionResponse:
    try:
        dto = await mediator.send(
            ValidateReportDefinition(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                report_id=report_id,
                mediator=mediator,
            )
        )
    except EntityNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return report_definition_dto_to_response(dto)


@router.post(
    "/projects/{project_id}/report-definitions/{report_id}/publish",
    response_model=ReportDefinitionResponse,
)
async def publish_report_definition(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ReportDefinitionResponse:
    try:
        dto = await mediator.send(
            PublishReportDefinition(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                report_id=report_id,
            )
        )
    except EntityNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return report_definition_dto_to_response(dto)


@router.get("/projects/{project_id}/report-definitions/{report_id}/execute")
async def execute_report_definition(
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
    allow_draft: bool = Query(True, description="If false, only published definitions run"),
    row_limit: int = Query(5000, ge=1, le=50_000),
) -> dict:
    """Run report: rows/columns for tables + chart_spec for UI (Recharts, etc.)."""
    try:
        return await mediator.query(
            ExecuteStoredReport(
                tenant_id=org.tenant_id,
                project_id=project_id,
                user_id=user.id,
                report_id=report_id,
                mediator=mediator,
                allow_draft=allow_draft,
                row_limit=row_limit,
            )
        )
    except EntityNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
