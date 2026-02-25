"""Get list schema (columns + filters) for entity type from project manifest."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.mpc_resolver import manifest_defs_to_flat
from alm.form_schema.domain.entities import (
    ListColumnSchema,
    ListFilterSchema,
    ListSchema,
)
from alm.shared.application.query import Query, QueryHandler
from alm.project.domain.ports import ProjectRepository
from alm.process_template.domain.ports import ProcessTemplateRepository


@dataclass(frozen=True)
class GetListSchema(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    entity_type: str = "artifact"


def _get_flat_manifest(manifest_bundle: dict) -> dict:
    """Return flat {workflows, artifact_types}; support both defs and top-level flat format."""
    if manifest_bundle.get("defs"):
        return manifest_defs_to_flat(manifest_bundle)
    return {
        "workflows": manifest_bundle.get("workflows") or [],
        "artifact_types": manifest_bundle.get("artifact_types") or [],
    }


def _humanize_id(field_id: str) -> str:
    if not field_id:
        return ""
    return field_id.replace("_", " ").replace("-", " ").title()


def _build_artifact_list_schema(flat: dict) -> ListSchema:
    columns_list: list[ListColumnSchema] = [
        ListColumnSchema(key="artifact_key", label="Key", order=1, sortable=True),
        ListColumnSchema(key="artifact_type", label="Type", order=2, sortable=True),
        ListColumnSchema(key="title", label="Title", order=3, sortable=True),
        ListColumnSchema(key="state", label="State", order=4, sortable=True),
        ListColumnSchema(key="state_reason", label="State reason", order=5, sortable=False),
        ListColumnSchema(key="resolution", label="Resolution", order=6, sortable=False),
        ListColumnSchema(key="created_at", label="Created", order=7, sortable=True),
        ListColumnSchema(key="updated_at", label="Updated", order=8, sortable=True),
    ]
    artifact_types = flat.get("artifact_types") or []
    seen_field_keys: set[str] = set()
    order = 10
    for at in artifact_types:
        for f in at.get("fields") or []:
            if not isinstance(f, dict):
                continue
            key = f.get("id") or f.get("key")
            if not key or key in seen_field_keys:
                continue
            seen_field_keys.add(key)
            label = f.get("name") or f.get("label") or _humanize_id(key)
            col_type = f.get("type") or "string"
            columns_list.append(
                ListColumnSchema(
                    key=key,
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
        filters_list.append(
            ListFilterSchema(key="type", label="Type", type="choice", order=1, options=type_options)
        )
    workflows = flat.get("workflows") or []
    all_states: list[str] = []
    for w in workflows:
        for s in w.get("states") or []:
            if s and s not in all_states:
                all_states.append(s)
    if all_states:
        filters_list.append(
            ListFilterSchema(key="state", label="State", type="choice", order=2, options=all_states)
        )
    return ListSchema(
        entity_type="artifact",
        columns=columns,
        filters=tuple(filters_list),
    )


# Fixed task states for list filter (no manifest dependency)
_TASK_STATE_OPTIONS = ("todo", "in_progress", "done")


def _build_task_list_schema() -> ListSchema:
    """Build fixed list schema for task entity (P3 — Task form/list schema)."""
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
            options=list(_TASK_STATE_OPTIONS),
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
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo

    async def handle(self, query: Query) -> ListSchema | None:
        assert isinstance(query, GetListSchema)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        if query.entity_type == "task":
            return _build_task_list_schema()

        if query.entity_type != "artifact":
            return None

        if project.process_template_version_id is None:
            return None

        version = await self._process_template_repo.find_version_by_id(
            project.process_template_version_id
        )
        if version is None:
            return None

        manifest_bundle = version.manifest_bundle or {}
        flat = _get_flat_manifest(manifest_bundle)
        return _build_artifact_list_schema(flat)
