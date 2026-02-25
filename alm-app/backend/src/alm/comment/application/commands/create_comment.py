"""Create comment on an artifact."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.shared.application.command import Command, CommandHandler
from alm.shared.domain.exceptions import ValidationError
from alm.comment.application.dtos import CommentDTO
from alm.comment.domain.entities import Comment
from alm.comment.domain.ports import CommentRepository
from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository


@dataclass(frozen=True)
class CreateComment(Command):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    body: str
    created_by: uuid.UUID


class CreateCommentHandler(CommandHandler[CommentDTO]):
    def __init__(
        self,
        comment_repo: CommentRepository,
        artifact_repo: ArtifactRepository,
        project_repo: ProjectRepository,
    ) -> None:
        self._comment_repo = comment_repo
        self._artifact_repo = artifact_repo
        self._project_repo = project_repo

    async def handle(self, command: Command) -> CommentDTO:
        assert isinstance(command, CreateComment)

        project = await self._project_repo.find_by_id(command.project_id)
        if project is None or project.tenant_id != command.tenant_id:
            raise ValidationError("Project not found")

        artifact = await self._artifact_repo.find_by_id(command.artifact_id)
        if artifact is None or artifact.project_id != command.project_id:
            raise ValidationError("Artifact not found")

        body = (command.body or "").strip()
        if not body:
            raise ValidationError("Comment body is required")

        comment = Comment.create(
            project_id=command.project_id,
            artifact_id=command.artifact_id,
            body=body,
            created_by=command.created_by,
        )
        await self._comment_repo.add(comment)

        return CommentDTO(
            id=comment.id,
            project_id=comment.project_id,
            artifact_id=comment.artifact_id,
            body=comment.body,
            created_by=comment.created_by,
            created_at=comment.created_at.isoformat() if comment.created_at else None,
            updated_at=comment.updated_at.isoformat() if comment.updated_at else None,
        )
