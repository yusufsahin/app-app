"""Artifact repository port."""
from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.artifact.domain.entities import Artifact


class ArtifactRepository:
    """Port for artifact persistence."""

    @abstractmethod
    async def find_by_id(self, artifact_id: uuid.UUID) -> Artifact | None:
        ...

    @abstractmethod
    async def list_by_project(
        self, project_id: uuid.UUID, state_filter: str | None = None
    ) -> list[Artifact]:
        ...

    @abstractmethod
    async def add(self, artifact: Artifact) -> Artifact:
        ...

    @abstractmethod
    async def update(self, artifact: Artifact) -> Artifact:
        ...
