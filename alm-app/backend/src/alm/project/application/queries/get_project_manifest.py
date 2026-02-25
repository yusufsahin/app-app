"""Get manifest bundle for a project's process template version."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class GetProjectManifest(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID


@dataclass
class ProjectManifestResult:
    """Manifest for a project's process template version."""

    manifest_bundle: dict[str, Any]
    template_name: str
    template_slug: str
    version: str


class GetProjectManifestHandler(QueryHandler[ProjectManifestResult | None]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        process_template_repo: ProcessTemplateRepository,
    ) -> None:
        self._project_repo = project_repo
        self._process_template_repo = process_template_repo

    async def handle(self, query: Query) -> ProjectManifestResult | None:
        assert isinstance(query, GetProjectManifest)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return None

        if project.process_template_version_id is None:
            return None

        version = await self._process_template_repo.find_version_by_id(project.process_template_version_id)
        if version is None:
            return None

        template = await self._process_template_repo.find_by_id(version.template_id)
        template_name = template.name if template else "Unknown"
        template_slug = template.slug if template else "unknown"

        return ProjectManifestResult(
            manifest_bundle=version.manifest_bundle or {},
            template_name=template_name,
            template_slug=template_slug,
            version=version.version,
        )
