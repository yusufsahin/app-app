"""ArtifactLink repository port."""

from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.artifact_link.domain.entities import ArtifactLink


class ArtifactLinkRepository:
    @abstractmethod
    async def find_by_id(self, link_id: uuid.UUID) -> ArtifactLink | None: ...

    @abstractmethod
    async def list_by_artifact(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
    ) -> list[ArtifactLink]:
        """List all links where the given artifact is either from or to."""
        ...

    @abstractmethod
    async def add(self, link: ArtifactLink) -> ArtifactLink: ...

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

    @abstractmethod
    async def max_sort_order_for_outgoing(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
    ) -> int | None:
        """Max sort_order for links with this from_artifact and link_type, or None if none."""

    @abstractmethod
    async def list_outgoing_link_ids(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
    ) -> list[uuid.UUID]:
        """Stable order: sort_order ASC NULLS LAST, then created_at ASC."""

    @abstractmethod
    async def set_sort_orders_for_outgoing(
        self,
        project_id: uuid.UUID,
        from_artifact_id: uuid.UUID,
        link_type: str,
        ordered_link_ids: list[uuid.UUID],
    ) -> None:
        """Set sort_order to index for each link id; all must match from+type."""

    @abstractmethod
    async def list_candidate_run_test_pairs(
        self,
        project_id: uuid.UUID,
        test_ids: list[uuid.UUID],
    ) -> list[tuple[uuid.UUID, uuid.UUID]]:
        """Pairs ``(test_run_id, test_case_id)`` where the run may include the test (suite or direct path)."""

    @abstractmethod
    async def list_outgoing_links_from_artifacts(
        self,
        project_id: uuid.UUID,
        from_artifact_ids: list[uuid.UUID],
    ) -> list[ArtifactLink]:
        """All links with ``from_artifact_id`` in the given set."""

    @abstractmethod
    async def list_suite_includes_tests_for_suites(
        self,
        project_id: uuid.UUID,
        suite_ids: list[uuid.UUID],
    ) -> list[ArtifactLink]:
        """Outgoing ``suite_includes_test`` links from each suite id."""
