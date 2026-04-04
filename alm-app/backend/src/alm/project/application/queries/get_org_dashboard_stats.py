"""Dashboard stats for an org (tenant): projects, artifacts, tasks, open defects."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.manifest_merge_defaults import merge_manifest_metadata_defaults
from alm.artifact.domain.manifest_workflow_metadata import resolve_system_root_artifact_types
from alm.artifact.domain.ports import ArtifactRepository
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.application.services.effective_process_template_version import (
    effective_process_template_version,
)
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler
from alm.task.domain.ports import TaskRepository


@dataclass(frozen=True)
class GetOrgDashboardStats(Query):
    tenant_id: uuid.UUID


@dataclass
class OrgDashboardStatsResult:
    projects: int
    artifacts: int
    tasks: int
    open_defects: int


async def _system_root_types_for_project(
    process_template_repo: ProcessTemplateRepository,
    process_template_version_id: uuid.UUID | None,
) -> frozenset[str]:
    version = await effective_process_template_version(
        process_template_repo, process_template_version_id
    )
    if version is None:
        return resolve_system_root_artifact_types(merge_manifest_metadata_defaults({}))
    merged = merge_manifest_metadata_defaults(version.manifest_bundle or {})
    return resolve_system_root_artifact_types(merged)


class GetOrgDashboardStatsHandler(QueryHandler[OrgDashboardStatsResult]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        artifact_repo: ArtifactRepository,
        task_repo: TaskRepository,
        process_template_repo: ProcessTemplateRepository,
    ) -> None:
        self._project_repo = project_repo
        self._artifact_repo = artifact_repo
        self._task_repo = task_repo
        self._process_template_repo = process_template_repo

    async def handle(self, query: Query) -> OrgDashboardStatsResult:
        assert isinstance(query, GetOrgDashboardStats)

        projects = await self._project_repo.list_by_tenant(query.tenant_id)
        project_ids = [p.id for p in projects]

        artifacts = 0
        for p in projects:
            roots = await _system_root_types_for_project(
                self._process_template_repo,
                p.process_template_version_id,
            )
            artifacts += await self._artifact_repo.count_by_project(
                p.id,
                exclude_root_artifact_types=True,
                root_type_ids_exclude=roots,
            )

        open_defects = await self._artifact_repo.count_open_defects_by_project_ids(project_ids)
        tasks = await self._task_repo.count_by_project_ids(project_ids)

        return OrgDashboardStatsResult(
            projects=len(projects),
            artifacts=artifacts,
            tasks=tasks,
            open_defects=open_defects,
        )
