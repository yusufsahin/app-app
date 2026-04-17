"""Run stored report definitions (builtin registry or guarded SQL)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from alm.report_definition.domain.entities import ReportDefinition
from alm.reporting.application.builtin import execute_report
from alm.reporting.application.sql_guard import validate_report_sql, wrap_select_limit
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import ValidationError


def _json_safe(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


async def run_stored_report(
    *,
    session: AsyncSession,
    mediator: Mediator,
    definition: ReportDefinition,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    row_limit: int = 5000,
) -> dict[str, Any]:
    if definition.query_kind == "builtin":
        if not definition.builtin_report_id:
            raise ValidationError("builtin_report_id is required")
        params: dict[str, Any] = dict(definition.builtin_parameters or {})
        bid = definition.builtin_report_id
        if bid in ("project.velocity", "project.burndown"):
            params = {**params, "project_id": str(project_id)}
        payload = await execute_report(
            report_id=bid,
            tenant_id=tenant_id,
            parameters=params,
            mediator=mediator,
            row_limit=row_limit,
        )
        data = payload.get("data") or {}
        if bid in ("project.velocity", "project.burndown") and isinstance(data.get("series"), list):
            rows = data["series"]
            columns = list(rows[0].keys()) if rows and isinstance(rows[0], dict) else []
            return {
                "query_kind": "builtin",
                "chart_spec": definition.chart_spec,
                "columns": columns,
                "rows": [_json_safe(r) for r in rows],
                "row_limit": row_limit,
                "raw": _json_safe(payload),
            }
        flat = _json_safe(data) if isinstance(data, dict) else {"value": _json_safe(data)}
        columns = list(flat.keys())
        rows = [flat]
        return {
            "query_kind": "builtin",
            "chart_spec": definition.chart_spec,
            "columns": columns,
            "rows": rows,
            "row_limit": row_limit,
            "raw": _json_safe(payload),
        }

    if definition.query_kind == "sql":
        if not definition.sql_text:
            raise ValidationError("sql_text is required")
        raw_sql = validate_report_sql(definition.sql_text, require_project_scope=True)
        wrapped = wrap_select_limit(raw_sql, row_limit)
        binds: dict[str, Any] = {"project_id": project_id, "tenant_id": tenant_id}
        for k, v in (definition.sql_bind_overrides or {}).items():
            if k in ("project_id", "tenant_id", "_limit"):
                continue
            if not isinstance(k, str) or not k.isidentifier():
                continue
            binds[k] = v
        result = await session.execute(text(wrapped), binds)
        columns = list(result.keys())
        rows_raw = result.fetchall()
        rows = []
        for row in rows_raw:
            row_dict = {columns[i]: row[i] for i in range(len(columns))}
            rows.append({k: _json_safe(row_dict[k]) for k in columns})
        return {
            "query_kind": "sql",
            "chart_spec": definition.chart_spec,
            "columns": columns,
            "rows": rows,
            "row_limit": row_limit,
            "raw": {"row_count": len(rows)},
        }

    raise ValidationError(f"Unsupported query_kind: {definition.query_kind}")
