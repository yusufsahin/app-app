"""Artifact repository port."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from alm.artifact.domain.entities import Artifact

if TYPE_CHECKING:
    from alm.shared.domain.specification import Specification


class ArtifactRepository(ABC):
    """Port for artifact persistence."""

    @abstractmethod
    async def find_by_id(self, artifact_id: uuid.UUID) -> Artifact | None: ...

    @abstractmethod
    async def find_by_id_include_deleted(self, artifact_id: uuid.UUID) -> Artifact | None:
        """Load artifact by id even if soft-deleted (e.g. for restore)."""
        ...

    @abstractmethod
    async def list_by_project(
        self,
        project_id: uuid.UUID,
        state_filter: str | None = None,
        type_filter: str | None = None,
        search_query: str | None = None,
        cycle_node_id: uuid.UUID | None = None,
        area_node_id: uuid.UUID | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        include_deleted: bool = False,
    ) -> list[Artifact]: ...

    @abstractmethod
    async def count_by_project(
        self,
        project_id: uuid.UUID,
        state_filter: str | None = None,
        type_filter: str | None = None,
        search_query: str | None = None,
        cycle_node_id: uuid.UUID | None = None,
        area_node_id: uuid.UUID | None = None,
        include_deleted: bool = False,
    ) -> int:
        """Count artifacts matching the same filters as list_by_project (no limit/offset)."""
        ...

    @abstractmethod
    async def list_by_spec(self, spec: Specification[Artifact]) -> list[Artifact]:
        """List artifacts satisfying specification (in-memory filter after fetch)."""
        ...

    @abstractmethod
    async def add(self, artifact: Artifact) -> Artifact: ...

    @abstractmethod
    async def update(self, artifact: Artifact) -> Artifact: ...

    @abstractmethod
    async def count_by_project_ids(self, project_ids: list[uuid.UUID]) -> int:
        """Total artifact count for the given projects (non-deleted)."""
        ...

    @abstractmethod
    async def count_open_defects_by_project_ids(self, project_ids: list[uuid.UUID]) -> int:
        """Count defects/bugs not in a final state (closed, done)."""
        ...

    @abstractmethod
    async def count_tasks_by_project_ids(self, project_ids: list[uuid.UUID]) -> int:
        """Count artifacts of type task or requirement (non-deleted)."""
        ...

    @abstractmethod
    async def list_recent_by_project_ids(
        self, project_ids: list[uuid.UUID], limit: int = 20
    ) -> list[tuple[uuid.UUID, uuid.UUID, str, str, str, object]]:
        """List recent artifacts (id, project_id, title, state, artifact_type, updated_at) by updated_at desc."""
        ...

    @abstractmethod
    async def sum_effort_by_cycles(
        self,
        project_id: uuid.UUID,
        cycle_node_ids: list[uuid.UUID],
        done_states: tuple[str, ...],
        effort_field: str,
    ) -> list[tuple[uuid.UUID, float]]:
        """Sum effort (from custom_fields[effort_field]) per cycle for artifacts in done_states. Returns [(cycle_node_id, total), ...]."""
        ...

    @abstractmethod
    async def sum_total_effort_by_cycles(
        self,
        project_id: uuid.UUID,
        cycle_node_ids: list[uuid.UUID],
        effort_field: str,
    ) -> list[tuple[uuid.UUID, float]]:
        """Sum effort (from custom_fields[effort_field]) per cycle for all artifacts in cycle. Returns [(cycle_node_id, total), ...]."""
        ...


class IArtifactTransitionMetrics(ABC):
    """Port for recording artifact transition metrics (observability). Implemented in infrastructure."""

    @abstractmethod
    def record_duration_seconds(self, duration: float) -> None: ...

    @abstractmethod
    def record_result(self, result: str) -> None: ...
