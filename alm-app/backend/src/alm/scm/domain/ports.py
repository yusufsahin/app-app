"""SCM link repository port."""

from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.scm.domain.entities import ScmLink


class ScmLinkRepository:
    @abstractmethod
    async def find_by_id(self, link_id: uuid.UUID) -> ScmLink | None: ...

    @abstractmethod
    async def list_by_artifact(
        self,
        artifact_id: uuid.UUID,
        *,
        task_id: uuid.UUID | None = None,
    ) -> list[ScmLink]: ...

    @abstractmethod
    async def add(self, link: ScmLink) -> ScmLink: ...

    @abstractmethod
    async def delete(self, link_id: uuid.UUID) -> bool: ...
