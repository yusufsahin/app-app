"""Recent artifact activity for org dashboard (D3)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from alm.shared.application.query import Query, QueryHandler
from alm.project.domain.ports import ProjectRepository
from alm.artifact.domain.ports import ArtifactRepository


@dataclass(frozen=True)
class GetOrgDashboardActivity(Query):
    tenant_id: uuid.UUID
    limit: int = 20


@dataclass
class DashboardActivityItem:
    artifact_id: uuid.UUID
    project_id: uuid.UUID
    project_slug: str
    title: str
    state: str
    artifact_type: str
    updated_at: datetime | None


class GetOrgDashboardActivityHandler(QueryHandler[list[DashboardActivityItem]]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        artifact_repo: ArtifactRepository,
    ) -> None:
        self._project_repo = project_repo
        self._artifact_repo = artifact_repo

    async def handle(self, query: Query) -> list[DashboardActivityItem]:
        assert isinstance(query, GetOrgDashboardActivity)

        projects = await self._project_repo.list_by_tenant(query.tenant_id)
        project_ids = [p.id for p in projects]
        slug_by_id = {p.id: p.slug for p in projects}

        rows = await self._artifact_repo.list_recent_by_project_ids(
            project_ids, limit=query.limit
        )
        return [
            DashboardActivityItem(
                artifact_id=r[0],
                project_id=r[1],
                project_slug=slug_by_id.get(r[1], ""),
                title=r[2],
                state=r[3],
                artifact_type=r[4],
                updated_at=r[5],
            )
            for r in rows
        ]
