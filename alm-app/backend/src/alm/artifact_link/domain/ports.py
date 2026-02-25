"""ArtifactLink repository port."""
from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.artifact_link.domain.entities import ArtifactLink


class ArtifactLinkRepository:
    @abstractmethod
    async def find_by_id(self, link_id: uuid.UUID) -> ArtifactLink | None:
        ...

    @abstractmethod
    async def list_by_artifact(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
    ) -> list[ArtifactLink]:
        """List all links where the given artifact is either from or to."""
        ...

    @abstractmethod
    async def add(self, link: ArtifactLink) -> ArtifactLink:
        ...

    @abstractmethod
    async def delete(self, link_id: uuid.UUID) -> bool:
        """Delete link by id. Returns True if found and deleted."""
        ...

    @abstractmethod
    async def exists(
        self,
        from_artifact_id: uuid.UUID,
        to_artifact_id: uuid.UUID,
        link_type: str,
    ) -> bool:
        """True if a link with the same from, to and type already exists."""
        ...
