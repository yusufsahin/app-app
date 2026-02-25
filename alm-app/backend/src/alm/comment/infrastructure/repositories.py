"""Comment SQLAlchemy repository."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.comment.domain.entities import Comment
from alm.comment.domain.ports import CommentRepository
from alm.comment.infrastructure.models import CommentModel


class SqlAlchemyCommentRepository(CommentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_artifact(self, artifact_id: uuid.UUID) -> list[Comment]:
        result = await self._session.execute(
            select(CommentModel)
            .where(CommentModel.artifact_id == artifact_id)
            .order_by(CommentModel.created_at.asc())
        )
        return [self._to_entity(m) for m in result.scalars().all()]

    async def add(self, comment: Comment) -> Comment:
        model = CommentModel(
            id=comment.id,
            project_id=comment.project_id,
            artifact_id=comment.artifact_id,
            body=comment.body,
            created_by=comment.created_by,
        )
        self._session.add(model)
        await self._session.flush()
        return comment

    @staticmethod
    def _to_entity(m: CommentModel) -> Comment:
        return Comment(
            id=m.id,
            project_id=m.project_id,
            artifact_id=m.artifact_id,
            body=m.body,
            created_by=m.created_by,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
