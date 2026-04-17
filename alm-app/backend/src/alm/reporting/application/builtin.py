"""Built-in report registrations. Add a new ReportSpec + param model + handler to extend."""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from alm.project.application.queries.get_burndown import BurndownPointDTO, GetBurndown
from alm.project.application.queries.get_org_dashboard_stats import GetOrgDashboardStats
from alm.project.application.queries.get_velocity import GetVelocity, VelocityPointDTO
from alm.reporting.application.spec import ReportSpec
from alm.shared.application.mediator import Mediator


class UnknownReportIdError(LookupError):
    pass


class ReportParametersValidationError(Exception):
    """Wraps Pydantic validation errors so HTTP layers can return 422 without ExceptionGroup issues."""

    def __init__(self, errors: list[Any]) -> None:
        self.errors = errors
        super().__init__("report parameters invalid")


class OrgDashboardParams(BaseModel):
    model_config = ConfigDict(extra="forbid")


class VelocityReportParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: uuid.UUID
    last_n: int | None = Field(default=6, ge=1, le=100)
    effort_field: str = Field(default="story_points", min_length=1, max_length=128)
    release_id: uuid.UUID | None = None


class BurndownReportParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: uuid.UUID
    last_n: int | None = Field(default=6, ge=1, le=100)
    effort_field: str = Field(default="story_points", min_length=1, max_length=128)


Handler = Callable[[Mediator, uuid.UUID, BaseModel], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class _Registration:
    spec: ReportSpec
    param_model: type[BaseModel]
    run: Handler


def _velocity_points(rows: list[VelocityPointDTO]) -> list[dict[str, Any]]:
    return [
        {
            "cycle_id": str(r.cycle_id),
            "cycle_name": r.cycle_name,
            "total_effort": r.total_effort,
        }
        for r in rows
    ]


def _burndown_points(rows: list[BurndownPointDTO]) -> list[dict[str, Any]]:
    return [
        {
            "cycle_id": str(r.cycle_id),
            "cycle_name": r.cycle_name,
            "total_effort": r.total_effort,
            "completed_effort": r.completed_effort,
            "remaining_effort": r.remaining_effort,
        }
        for r in rows
    ]


async def _run_org_dashboard(mediator: Mediator, tenant_id: uuid.UUID, params: BaseModel) -> dict[str, Any]:
    assert isinstance(params, OrgDashboardParams)
    stats = await mediator.query(GetOrgDashboardStats(tenant_id=tenant_id))
    return {
        "projects": stats.projects,
        "artifacts": stats.artifacts,
        "tasks": stats.tasks,
        "openDefects": stats.open_defects,
    }


async def _run_velocity(mediator: Mediator, tenant_id: uuid.UUID, params: BaseModel) -> dict[str, Any]:
    assert isinstance(params, VelocityReportParams)
    rows = await mediator.query(
        GetVelocity(
            tenant_id=tenant_id,
            project_id=params.project_id,
            release_id=params.release_id,
            last_n=params.last_n,
            effort_field=params.effort_field,
        )
    )
    return {"series": _velocity_points(rows)}


async def _run_burndown(mediator: Mediator, tenant_id: uuid.UUID, params: BaseModel) -> dict[str, Any]:
    assert isinstance(params, BurndownReportParams)
    rows = await mediator.query(
        GetBurndown(
            tenant_id=tenant_id,
            project_id=params.project_id,
            last_n=params.last_n,
            effort_field=params.effort_field,
        )
    )
    return {"series": _burndown_points(rows)}


_REGISTRY: dict[str, _Registration] = {
    "org.dashboard_snapshot": _Registration(
        spec=ReportSpec(
            id="org.dashboard_snapshot",
            title="Organization dashboard snapshot",
            description="Project, artifact, task, and open defect counts for the org (tenant).",
            category="portfolio",
            scope="org",
        ),
        param_model=OrgDashboardParams,
        run=_run_org_dashboard,
    ),
    "project.velocity": _Registration(
        spec=ReportSpec(
            id="project.velocity",
            title="Velocity by cycle",
            description="Sum of completed effort per planning cycle (configurable effort field).",
            category="planning",
            scope="project",
        ),
        param_model=VelocityReportParams,
        run=_run_velocity,
    ),
    "project.burndown": _Registration(
        spec=ReportSpec(
            id="project.burndown",
            title="Burndown by cycle",
            description="Total, completed, and remaining effort per cycle.",
            category="planning",
            scope="project",
        ),
        param_model=BurndownReportParams,
        run=_run_burndown,
    ),
}


def is_registered_report_id(report_id: str) -> bool:
    return report_id in _REGISTRY


def list_report_definitions() -> list[dict[str, Any]]:
    """Catalog for UIs and integrations: each entry includes a JSON Schema for parameters."""
    out: list[dict[str, Any]] = []
    for reg in sorted(_REGISTRY.values(), key=lambda r: r.spec.id):
        s = reg.spec
        out.append(
            {
                "id": s.id,
                "title": s.title,
                "description": s.description,
                "category": s.category,
                "scope": s.scope,
                "parameter_schema": reg.param_model.model_json_schema(),
            }
        )
    return out


async def execute_report(
    *,
    report_id: str,
    tenant_id: uuid.UUID,
    parameters: dict[str, Any],
    mediator: Mediator,
    row_limit: int = 5000,
) -> dict[str, Any]:
    reg = _REGISTRY.get(report_id)
    if reg is None:
        raise UnknownReportIdError(report_id)
    try:
        validated = reg.param_model.model_validate(parameters)
    except ValidationError as exc:
        raise ReportParametersValidationError(exc.errors()) from exc
    data = await reg.run(mediator, tenant_id, validated)
    out_data = dict(data)
    series = out_data.get("series")
    if isinstance(series, list):
        out_data = {**out_data, "series": series[:row_limit]}
    return {
        "report_id": report_id,
        "parameters": validated.model_dump(mode="json"),
        "data": out_data,
        "row_limit": row_limit,
    }
