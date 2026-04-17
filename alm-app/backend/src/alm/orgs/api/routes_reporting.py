"""Flexible reporting API: catalog of report definitions + validated parameter runs."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from alm.orgs.api._router_deps import *  # noqa: F403
from alm.reporting.api.schemas import ReportRunRequest, ReportRunResponse
from alm.reporting.application.builtin import (
    ReportParametersValidationError,
    UnknownReportIdError,
    execute_report,
    list_report_definitions,
)

router = APIRouter()


@router.get("/reports/definitions")
async def get_report_definitions(
    _org: ResolvedOrg = Depends(resolve_org),
    _: CurrentUser = require_permission("project:read"),
) -> list[dict]:
    """List registered reports and JSON Schema for each report's parameters (for dynamic UIs)."""
    return list_report_definitions()


@router.post("/reports/run", response_model=ReportRunResponse)
async def run_report(
    body: ReportRunRequest,
    org: ResolvedOrg = Depends(resolve_org),
    _: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> ReportRunResponse:
    """Execute a report by id with a parameter object validated per report."""
    try:
        payload = await execute_report(
            report_id=body.report_id,
            tenant_id=org.tenant_id,
            parameters=body.parameters,
            mediator=mediator,
            row_limit=body.row_limit,
        )
    except UnknownReportIdError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown report_id: {exc}") from exc
    except ReportParametersValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors) from exc

    return ReportRunResponse.model_validate(payload)
