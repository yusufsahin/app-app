"""Get form schema query."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.form_schema.application.builders.manifest_form_schema_builder import (
    build_form_schema,
)
from alm.form_schema.domain.entities import FormSchema
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.ports import IManifestDefsFlattener


@dataclass(frozen=True)
class GetFormSchema(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    entity_type: str = "artifact"
    context: str = "create"


class GetFormSchemaHandler(QueryHandler[FormSchema | None]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
        manifest_flattener: IManifestDefsFlattener,
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo
        self._manifest_flattener = manifest_flattener

    async def handle(self, query: Query) -> FormSchema | None:
        assert isinstance(query, GetFormSchema)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        # Task schema is fixed; no manifest required (P3)
        if query.entity_type == "task":
            return build_form_schema(
                {}, entity_type="task", context=query.context, flattener=self._manifest_flattener
            )
        # Artifact edit schema does not need full manifest (title, description, assignee only)
        if query.entity_type == "artifact" and query.context == "edit":
            return build_form_schema(
                {}, entity_type="artifact", context="edit", flattener=self._manifest_flattener
            )

        if project.process_template_version_id is None:
            return None

        version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        if version is None:
            return None

        manifest_bundle = version.manifest_bundle or {}
        return build_form_schema(
            manifest_bundle,
            entity_type=query.entity_type,
            context=query.context,
            flattener=self._manifest_flattener,
        )
