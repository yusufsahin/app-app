"""List SCM links for an artifact (optional task filter)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.scm.application.dtos import ScmLinkDTO
from alm.scm.domain.ports import ScmLinkRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListScmLinksByArtifact(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    task_id: uuid.UUID | None = None


class ListScmLinksByArtifactHandler(QueryHandler[list[ScmLinkDTO]]):
    def __init__(
        self,
        scm_repo: ScmLinkRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._scm_repo = scm_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[ScmLinkDTO]:
        assert isinstance(query, ListScmLinksByArtifact)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []

        artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if artifact is None or artifact.project_id != query.project_id:
            return []

        rows = await self._scm_repo.list_by_artifact(query.artifact_id, task_id=query.task_id)
        return [
            ScmLinkDTO(
                id=r.id,
                project_id=r.project_id,
                artifact_id=r.artifact_id,
                task_id=r.task_id,
                provider=r.provider,
                repo_full_name=r.repo_full_name,
                ref=r.ref,
                commit_sha=r.commit_sha,
                pull_request_number=r.pull_request_number,
                title=r.title,
                web_url=r.web_url,
                source=r.source,
                created_by=r.created_by,
                created_at=r.created_at.isoformat() if r.created_at else None,
                updated_at=r.updated_at.isoformat() if r.updated_at else None,
            )
            for r in rows
        ]
