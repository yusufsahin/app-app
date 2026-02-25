"""Comment repository port."""
from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.comment.domain.entities import Comment


class CommentRepository:
    @abstractmethod
    async def list_by_artifact(self, artifact_id: uuid.UUID) -> list[Comment]:
        ...

    @abstractmethod
    async def add(self, comment: Comment) -> Comment:
        ...
