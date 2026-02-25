"""Dashboard stats for an org (tenant): projects, artifacts, tasks, open defects."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.query import Query, QueryHandler
from alm.project.domain.ports import ProjectRepository
from alm.artifact.domain.ports import ArtifactRepository
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


class GetOrgDashboardStatsHandler(QueryHandler[OrgDashboardStatsResult]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        artifact_repo: ArtifactRepository,
        task_repo: TaskRepository,
    ) -> None:
        self._project_repo = project_repo
        self._artifact_repo = artifact_repo
        self._task_repo = task_repo

    async def handle(self, query: Query) -> OrgDashboardStatsResult:
        assert isinstance(query, GetOrgDashboardStats)

        projects = await self._project_repo.list_by_tenant(query.tenant_id)
        project_ids = [p.id for p in projects]

        artifacts = await self._artifact_repo.count_by_project_ids(project_ids)
        open_defects = await self._artifact_repo.count_open_defects_by_project_ids(
            project_ids
        )
        tasks = await self._task_repo.count_by_project_ids(project_ids)

        return OrgDashboardStatsResult(
            projects=len(projects),
            artifacts=artifacts,
            tasks=tasks,
            open_defects=open_defects,
        )
