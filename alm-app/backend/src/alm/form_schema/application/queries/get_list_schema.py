"""Get list schema (columns + filters) for entity type from project manifest."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.artifact.domain.manifest_merge_defaults import merge_manifest_metadata_defaults
from alm.artifact.domain.manifest_workflow_metadata import get_task_state_options_and_initial
from alm.form_schema.domain.entities import (
    ListColumnSchema,
    ListFilterSchema,
    ListSchema,
    LookupSchema,
)
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.ports import IManifestDefsFlattener


@dataclass(frozen=True)
class GetListSchema(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    entity_type: str = "artifact"
    surface: str | None = None


BACKLOG_COLUMN_ALLOWLIST = {
    "artifact_key",
    "artifact_type",
    "title",
    "state",
    "priority",
    "story_points",
    "assignee_id",
    "tags",
    "updated_at",
}

DEFECTS_FIXED_COLUMN_KEYS = (
    "title",
    "state",
    "assignee_id",
    "severity",
    "updated_at",
)

DEFECTS_EXCLUDED_COLUMN_KEYS = {
    "artifact_key",
    "artifact_type",
    "description",
    "tags",
    "state_reason",
    "resolution",
    "created_at",
}
DEFECTS_EXTRA_COLUMN_LIMIT = 4


def _get_artifact_list_override(
    manifest_bundle: dict[str, Any] | None,
    surface: str | None,
) -> dict[str, Any]:
    mb = manifest_bundle or {}
    artifact_list = mb.get("artifact_list")
    if not isinstance(artifact_list, dict):
        return {}
    if surface:
        surfaces = artifact_list.get("surfaces")
        if isinstance(surfaces, dict):
            surface_override = surfaces.get(surface)
            if isinstance(surface_override, dict):
                return {
                    **artifact_list,
                    **surface_override,
                }
    return artifact_list


def _surface_column_policy(
    manifest_bundle: dict[str, Any] | None,
    surface: str | None,
) -> tuple[tuple[str, ...] | None, set[str], int | None]:
    if surface == "backlog":
        override = _get_artifact_list_override(manifest_bundle, surface)
        fixed = override.get("fixed_columns")
        fixed_columns = (
            tuple(str(item) for item in fixed if str(item).strip())
            if isinstance(fixed, list)
            else tuple(BACKLOG_COLUMN_ALLOWLIST)
        )
        return fixed_columns, set(), None

    if surface != "defects":
        return None, set(), None

    override = _get_artifact_list_override(manifest_bundle, surface)
    fixed = override.get("fixed_columns")
    exclude = override.get("exclude_columns")
    extra_limit = override.get("extra_column_limit")

    fixed_columns = (
        tuple(str(item) for item in fixed if str(item).strip())
        if isinstance(fixed, list)
        else DEFECTS_FIXED_COLUMN_KEYS
    )
    excluded_columns = (
        {str(item) for item in exclude if str(item).strip()}
        if isinstance(exclude, list)
        else DEFECTS_EXCLUDED_COLUMN_KEYS
    )
    extra_column_limit = int(extra_limit) if isinstance(extra_limit, int) and extra_limit >= 0 else DEFECTS_EXTRA_COLUMN_LIMIT
    return fixed_columns, excluded_columns, extra_column_limit


def _filter_columns_for_surface(
    columns: list[ListColumnSchema],
    surface: str | None,
    manifest_bundle: dict[str, Any] | None = None,
) -> list[ListColumnSchema]:
    fixed_columns, excluded_columns, extra_column_limit = _surface_column_policy(manifest_bundle, surface)
    if surface == "backlog" and fixed_columns is not None:
        filtered: list[ListColumnSchema] = []
        for column in columns:
            if column.key in fixed_columns:
                filtered.append(column)
        return filtered

    if surface != "defects" or fixed_columns is None:
        return columns

    ordered_by_key = {column.key: column for column in columns}
    filtered: list[ListColumnSchema] = [
        ordered_by_key[key]
        for key in fixed_columns
        if key in ordered_by_key
    ]
    filtered_keys = {column.key for column in filtered}
    extra_count = 0
    for column in columns:
        if column.key in filtered_keys or column.key in excluded_columns:
            continue
        filtered.append(column)
        extra_count += 1
        if extra_column_limit is not None and extra_count >= extra_column_limit:
            break
    return filtered


def _get_flat_manifest(manifest_bundle: dict[str, Any], flattener: IManifestDefsFlattener) -> dict[str, Any]:
    """Return flat {workflows, artifact_types}; support both defs and top-level flat format."""
    if manifest_bundle.get("defs"):
        return flattener.flatten(manifest_bundle)
    return {
        "workflows": manifest_bundle.get("workflows") or [],
        "artifact_types": manifest_bundle.get("artifact_types") or [],
    }


def _humanize_id(field_id: str) -> str:
    if not field_id:
        return ""
    return field_id.replace("_", " ").replace("-", " ").title()


def _infer_lookup(field_type: str | None, entity_ref: str | None = None) -> LookupSchema | None:
    if field_type == "tag_list" or field_type == "tags":
        return LookupSchema(kind="tag", multi=True, label_field="label", value_field="id")
    if field_type == "entity_ref" and entity_ref:
        return LookupSchema(kind=entity_ref, label_field="label", value_field="id")
    return None


def _column_surfaces(surface: str | None) -> tuple[str, ...]:
    return ("list", "tabular", surface) if surface else ("list", "tabular")


def _default_write_target(column_key: str) -> str:
    root_keys = {
        "artifact_key",
        "artifact_type",
        "title",
        "description",
        "state",
        "assignee_id",
        "team_id",
        "cycle_id",
        "area_node_id",
        "tag_ids",
        "tags",
        "rank_order",
    }
    return "root" if column_key in root_keys else "custom_field"


def _build_artifact_list_schema(
    flat: dict[str, Any],
    manifest_bundle: dict[str, Any] | None = None,
    surface: str | None = None,
) -> ListSchema:
    mb = manifest_bundle or {}
    al_override = _get_artifact_list_override(mb, surface)
    raw_cols = al_override.get("columns")
    columns_list: list[ListColumnSchema] = []
    seen_field_keys: set[str] = set()

    if isinstance(raw_cols, list) and raw_cols:
        for i, c in enumerate(raw_cols):
            if not isinstance(c, dict):
                continue
            key = c.get("key")
            if not key:
                continue
            sk = str(key)
            if c.get("visible") is False:
                seen_field_keys.add(sk)
                continue
            seen_field_keys.add(sk)
            columns_list.append(
                ListColumnSchema(
                    key=sk,
                    label=str(c.get("label") or _humanize_id(sk)),
                    type=str(c["type"]) if c.get("type") else None,
                    order=int(c.get("order", i + 1)),
                    sortable=bool(c.get("sortable", False)),
                    editable=bool(c.get("editable", False)),
                    surfaces=_column_surfaces(surface),
                    lookup=_infer_lookup(str(c.get("type")) if c.get("type") else None, str(c.get("entity_ref")) if c.get("entity_ref") else None),
                    write_target=str(c.get("write_target")) if c.get("write_target") else _default_write_target(sk),
                    write_key=str(c.get("write_key")) if c.get("write_key") else None,
                )
            )
    else:
        columns_list = [
            ListColumnSchema(key="artifact_key", label="Key", order=1, sortable=True),
            ListColumnSchema(key="artifact_type", label="Type", order=2, sortable=True),
            ListColumnSchema(key="title", label="Title", order=3, sortable=True, editable=True, surfaces=("list", "tabular"), write_target="root"),
            ListColumnSchema(key="state", label="State", order=4, sortable=True),
            ListColumnSchema(
                key="tags",
                label="Tags",
                type="tags",
                order=5,
                sortable=False,
                editable=True,
                surfaces=("list", "tabular"),
                lookup=LookupSchema(kind="tag", multi=True, label_field="label", value_field="id"),
                write_target="root",
                write_key="tag_ids",
            ),
            ListColumnSchema(key="state_reason", label="State reason", order=6, sortable=False),
            ListColumnSchema(key="resolution", label="Resolution", order=7, sortable=False),
            ListColumnSchema(key="created_at", label="Created", order=8, sortable=True),
            ListColumnSchema(key="updated_at", label="Updated", order=9, sortable=True),
        ]
        seen_field_keys = {c.key for c in columns_list}

    if "tags" not in seen_field_keys:
        seen_field_keys.add("tags")
        next_order = max((c.order for c in columns_list), default=0) + 1
        columns_list.append(
            ListColumnSchema(
                key="tags",
                label="Tags",
                type="tags",
                order=next_order,
                sortable=False,
                editable=True,
                surfaces=("list", "tabular"),
                lookup=LookupSchema(kind="tag", multi=True, label_field="label", value_field="id"),
                write_target="root",
                write_key="tag_ids",
            ),
        )

    artifact_types = flat.get("artifact_types") or []
    order = max((c.order for c in columns_list), default=0) + 1
    for at in artifact_types:
        for f in at.get("fields") or []:
            if not isinstance(f, dict):
                continue
            key = f.get("id") or f.get("key")
            if not key or key in seen_field_keys:
                continue
            seen_field_keys.add(str(key))
            label = f.get("name") or f.get("label") or _humanize_id(key)
            col_type = f.get("type") or "string"
            sk = str(key)
            entity_ref = str(f.get("entity_ref")).strip() if f.get("entity_ref") else None
            columns_list.append(
                ListColumnSchema(
                    key=sk,
                    label=label,
                    type=col_type,
                    order=order,
                    sortable=False,
                    editable=col_type in {"string", "number", "choice", "date", "datetime", "entity_ref", "tag_list"},
                    surfaces=("list", "tabular"),
                    lookup=_infer_lookup(str(col_type), entity_ref),
                    write_target=_default_write_target(sk),
                )
            )
            order += 1
    columns: tuple[ListColumnSchema, ...] = tuple(_filter_columns_for_surface(columns_list, surface, manifest_bundle))

    filters_list: list[ListFilterSchema] = []
    if artifact_types:
        type_options = [at.get("id") or "" for at in artifact_types if at.get("id")]
        filters_list.append(ListFilterSchema(key="type", label="Type", type="choice", order=1, options=type_options))
    workflows = flat.get("workflows") or []
    all_states: list[str] = []
    for w in workflows:
        for s in w.get("states") or []:
            if s and s not in all_states:
                all_states.append(s)
    if all_states:
        filters_list.append(ListFilterSchema(key="state", label="State", type="choice", order=2, options=all_states))
    return ListSchema(
        entity_type="artifact",
        columns=columns,
        filters=tuple(filters_list),
    )


def _build_task_list_schema(manifest_bundle: dict[str, Any] | None = None) -> ListSchema:
    """Build list schema for tasks; state filter options from manifest task workflow."""
    opts, _ = get_task_state_options_and_initial(manifest_bundle)
    state_options = tuple(o["id"] for o in opts)
    columns: tuple[ListColumnSchema, ...] = (
        ListColumnSchema(key="id", label="Id", order=1, sortable=True),
        ListColumnSchema(key="title", label="Title", order=2, sortable=True),
        ListColumnSchema(key="state", label="State", order=3, sortable=True),
        ListColumnSchema(key="assignee_id", label="Assignee", order=4, sortable=True),
        ListColumnSchema(key="rank_order", label="Rank", order=5, sortable=True),
        ListColumnSchema(key="created_at", label="Created", order=6, sortable=True),
        ListColumnSchema(key="updated_at", label="Updated", order=7, sortable=True),
    )
    filters: tuple[ListFilterSchema, ...] = (
        ListFilterSchema(
            key="state",
            label="State",
            type="choice",
            order=1,
            options=list(state_options),
        ),
    )
    return ListSchema(
        entity_type="task",
        columns=columns,
        filters=filters,
    )


class GetListSchemaHandler(QueryHandler[ListSchema | None]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
        manifest_flattener: IManifestDefsFlattener,
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._manifest_flattener = manifest_flattener

    async def handle(self, query: Query) -> ListSchema | None:
        assert isinstance(query, GetListSchema)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            # Return default artifact schema so Table view does not break with 404 (e.g. RLS/tenant timing)
            if query.entity_type == "artifact":
                return _build_artifact_list_schema(
                    {"workflows": [], "artifact_types": []},
                    None,
                    query.surface,
                )
            return None

        if query.entity_type == "task":
            task_bundle: dict[str, Any] | None = None
            if project.process_template_version_id:
                tv = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
                if tv and tv.manifest_bundle:
                    task_bundle = merge_manifest_metadata_defaults(tv.manifest_bundle)
            return _build_task_list_schema(task_bundle)

        if query.entity_type != "artifact":
            return None

        if project.process_template_version_id is None:
            return _build_artifact_list_schema({"workflows": [], "artifact_types": []}, None, query.surface)

        version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        if version is None:
            return _build_artifact_list_schema({"workflows": [], "artifact_types": []}, None, query.surface)

        manifest_bundle = merge_manifest_metadata_defaults(version.manifest_bundle or {})
        flat = _get_flat_manifest(manifest_bundle, self._manifest_flattener)
        return _build_artifact_list_schema(flat, manifest_bundle, query.surface)
