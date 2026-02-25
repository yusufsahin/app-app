"""List comments for an artifact."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.domain.ports import ArtifactRepository
from alm.comment.application.dtos import CommentDTO
from alm.comment.domain.ports import CommentRepository
from alm.project.domain.ports import ProjectRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass(frozen=True)
class ListCommentsByArtifact(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID


class ListCommentsByArtifactHandler(QueryHandler[list[CommentDTO]]):
    def __init__(
        self,
        comment_repo: CommentRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._comment_repo = comment_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, query: Query) -> list[CommentDTO]:
        assert isinstance(query, ListCommentsByArtifact)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            return []
        artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if artifact is None or artifact.project_id != query.project_id:
            return []

        comments = await self._comment_repo.list_by_artifact(query.artifact_id)
        return [
            CommentDTO(
                id=c.id,
                project_id=c.project_id,
                artifact_id=c.artifact_id,
                body=c.body,
                created_by=c.created_by,
                created_at=c.created_at.isoformat() if c.created_at else None,
                updated_at=c.updated_at.isoformat() if c.updated_at else None,
            )
            for c in comments
        ]
