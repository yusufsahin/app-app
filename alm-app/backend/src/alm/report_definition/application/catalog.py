"""Predefined report templates (fork to customize). OpenText QC–style SQL + builtin KPI."""

from __future__ import annotations

from typing import Any, TypedDict


class CatalogEntry(TypedDict, total=False):
    query_kind: str
    builtin_report_id: str
    sql_text: str
    name: str
    description: str
    chart_spec: dict[str, Any]
    builtin_parameters: dict[str, Any]


REPORT_TEMPLATE_CATALOG: dict[str, CatalogEntry] = {
    "tpl.builtin_org_dashboard": {
        "query_kind": "builtin",
        "builtin_report_id": "org.dashboard_snapshot",
        "name": "Organization dashboard snapshot",
        "description": "Project, artifact, task, and open defect counts (same as org dashboard stats).",
        "chart_spec": {
            "chartType": "kpi_grid",
            "fields": ["projects", "artifacts", "tasks", "openDefects"],
        },
        "builtin_parameters": {},
    },
    "tpl.sql_artifacts_by_type": {
        "query_kind": "sql",
        "sql_text": """
SELECT artifact_type, COUNT(*)::bigint AS cnt
FROM artifacts
WHERE project_id = CAST(:project_id AS uuid) AND deleted_at IS NULL
GROUP BY artifact_type
ORDER BY cnt DESC
""".strip(),
        "name": "Artifacts by type",
        "description": "Bar/table chart of work item counts grouped by artifact_type (uses JSONB-friendly row model).",
        "chart_spec": {
            "chartType": "bar",
            "xKey": "artifact_type",
            "yKeys": ["cnt"],
        },
    },
    "tpl.sql_custom_field_key": {
        "query_kind": "sql",
        "sql_text": """
SELECT
  COALESCE(custom_fields->>'priority', '(unset)') AS priority_bucket,
  COUNT(*)::bigint AS cnt
FROM artifacts
WHERE project_id = CAST(:project_id AS uuid) AND deleted_at IS NULL
GROUP BY 1
ORDER BY cnt DESC
""".strip(),
        "name": "Count by custom_fields priority",
        "description": "Example JSONB path: custom_fields->>'priority'. Adjust key for your manifest fields.",
        "chart_spec": {
            "chartType": "pie",
            "labelKey": "priority_bucket",
            "valueKey": "cnt",
        },
    },
    "tpl.builtin_velocity": {
        "query_kind": "builtin",
        "builtin_report_id": "project.velocity",
        "name": "Velocity (builtin)",
        "description": "Last cycles effort rollup; set chart to line/bar on series.total_effort.",
        "chart_spec": {
            "chartType": "line",
            "xKey": "cycle_name",
            "yKeys": ["total_effort"],
            "seriesPath": "series",
        },
        "builtin_parameters": {"last_n": 8, "effort_field": "story_points"},
    },
}


def list_catalog_keys() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for key in sorted(REPORT_TEMPLATE_CATALOG.keys()):
        e = REPORT_TEMPLATE_CATALOG[key]
        out.append(
            {
                "catalog_key": key,
                "name": e.get("name", key),
                "description": e.get("description", ""),
                "query_kind": e["query_kind"],
                "chart_spec": e.get("chart_spec", {}),
            }
        )
    return out
