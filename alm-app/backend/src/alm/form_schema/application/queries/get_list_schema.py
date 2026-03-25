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


def _build_artifact_list_schema(
    flat: dict[str, Any],
    manifest_bundle: dict[str, Any] | None = None,
) -> ListSchema:
    mb = manifest_bundle or {}
    al_override = mb.get("artifact_list") if isinstance(mb.get("artifact_list"), dict) else {}
    raw_cols = al_override.get("columns")
    columns_list: list[ListColumnSchema] = []
    seen_field_keys: set[str] = set()

    if isinstance(raw_cols, list) and raw_cols:
        for i, c in enumerate(raw_cols):
            if not isinstance(c, dict):
                continue
            if c.get("visible") is False:
                continue
            key = c.get("key")
            if not key:
                continue
            sk = str(key)
            seen_field_keys.add(sk)
            columns_list.append(
                ListColumnSchema(
                    key=sk,
                    label=str(c.get("label") or _humanize_id(sk)),
                    type=str(c["type"]) if c.get("type") else None,
                    order=int(c.get("order", i + 1)),
                    sortable=bool(c.get("sortable", False)),
                )
            )
    else:
        columns_list = [
            ListColumnSchema(key="artifact_key", label="Key", order=1, sortable=True),
            ListColumnSchema(key="artifact_type", label="Type", order=2, sortable=True),
            ListColumnSchema(key="title", label="Title", order=3, sortable=True),
            ListColumnSchema(key="state", label="State", order=4, sortable=True),
            ListColumnSchema(key="state_reason", label="State reason", order=5, sortable=False),
            ListColumnSchema(key="resolution", label="Resolution", order=6, sortable=False),
            ListColumnSchema(key="created_at", label="Created", order=7, sortable=True),
            ListColumnSchema(key="updated_at", label="Updated", order=8, sortable=True),
        ]
        seen_field_keys = {c.key for c in columns_list}

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
            columns_list.append(
                ListColumnSchema(
                    key=sk,
                    label=label,
                    type=col_type,
                    order=order,
                    sortable=False,
                )
            )
            order += 1
    columns: tuple[ListColumnSchema, ...] = tuple(columns_list)

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
                return _build_artifact_list_schema({"workflows": [], "artifact_types": []}, None)
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
            return _build_artifact_list_schema({"workflows": [], "artifact_types": []}, None)

        version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        if version is None:
            return _build_artifact_list_schema({"workflows": [], "artifact_types": []}, None)

        manifest_bundle = merge_manifest_metadata_defaults(version.manifest_bundle or {})
        flat = _get_flat_manifest(manifest_bundle, self._manifest_flattener)
        return _build_artifact_list_schema(flat, manifest_bundle)
