"""Relationship repository port."""

from __future__ import annotations

import uuid
from abc import abstractmethod

from alm.relationship.domain.entities import Relationship


class RelationshipRepository:
    @abstractmethod
    async def find_by_id(self, relationship_id: uuid.UUID) -> Relationship | None: ...

    @abstractmethod
    async def list_by_artifact(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
    ) -> list[Relationship]:
        ...

    @abstractmethod
    async def add(self, relationship: Relationship) -> Relationship: ...

    @abstractmethod
    async def delete(self, relationship_id: uuid.UUID) -> bool: ...

    @abstractmethod
    async def exists(
        self,
        source_artifact_id: uuid.UUID,
        target_artifact_id: uuid.UUID,
        relationship_type: str,
    ) -> bool: ...

    @abstractmethod
    async def max_sort_order_for_outgoing(
        self,
        project_id: uuid.UUID,
        source_artifact_id: uuid.UUID,
        relationship_type: str,
    ) -> int | None: ...

    @abstractmethod
    async def list_outgoing_relationship_ids(
        self,
        project_id: uuid.UUID,
        source_artifact_id: uuid.UUID,
        relationship_type: str,
    ) -> list[uuid.UUID]: ...

    @abstractmethod
    async def set_sort_orders_for_outgoing(
        self,
        project_id: uuid.UUID,
        source_artifact_id: uuid.UUID,
        relationship_type: str,
        ordered_relationship_ids: list[uuid.UUID],
    ) -> None: ...

    @abstractmethod
    async def list_candidate_run_test_pairs(
        self,
        project_id: uuid.UUID,
        test_ids: list[uuid.UUID],
    ) -> list[tuple[uuid.UUID, uuid.UUID]]: ...

    @abstractmethod
    async def list_outgoing_relationships_from_artifacts(
        self,
        project_id: uuid.UUID,
        source_artifact_ids: list[uuid.UUID],
    ) -> list[Relationship]: ...

    @abstractmethod
    async def list_suite_includes_tests_for_suites(
        self,
        project_id: uuid.UUID,
        suite_ids: list[uuid.UUID],
    ) -> list[Relationship]: ...

    @abstractmethod
    async def list_relationships_to_artifacts(
        self,
        project_id: uuid.UUID,
        target_artifact_ids: list[uuid.UUID],
        relationship_types: list[str],
    ) -> list[Relationship]: ...

    @abstractmethod
    async def list_run_ids_for_suite_targets(
        self,
        project_id: uuid.UUID,
        suite_ids: list[uuid.UUID],
    ) -> list[uuid.UUID]: ...
