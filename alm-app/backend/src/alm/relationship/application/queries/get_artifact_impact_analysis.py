"""Recursive upstream/downstream artifact impact analysis."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.project.domain.ports import ProjectRepository
from alm.relationship.application.dtos import (
    ArtifactImpactAnalysisNodeDTO,
    ArtifactImpactAnalysisResultDTO,
    ImpactHierarchyRefDTO,
)
from alm.relationship.domain.entities import Relationship
from alm.relationship.domain.ports import RelationshipRepository
from alm.relationship.domain.types import BLOCKS, IMPACTS, get_relationship_type
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError

DEFAULT_IMPACT_RELATIONSHIP_TYPES: tuple[str, ...] = (IMPACTS, BLOCKS)
MAX_IMPACT_DEPTH = 5


@dataclass(frozen=True)
class GetArtifactImpactAnalysis(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    artifact_id: uuid.UUID
    direction: str = "both"
    depth: int = 2
    relationship_types: tuple[str, ...] = DEFAULT_IMPACT_RELATIONSHIP_TYPES
    include_hierarchy: bool = True
    manifest_bundle: dict | None = None


class GetArtifactImpactAnalysisHandler(QueryHandler[ArtifactImpactAnalysisResultDTO]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        artifact_repo: ArtifactRepository,
        relationship_repo: RelationshipRepository,
    ) -> None:
        self._project_repo = project_repo
        self._artifact_repo = artifact_repo
        self._relationship_repo = relationship_repo
        self._artifact_cache: dict[uuid.UUID, Artifact] = {}
        self._outgoing_cache: dict[uuid.UUID, list[Relationship]] = {}
        self._incoming_cache: dict[tuple[uuid.UUID, tuple[str, ...]], list[Relationship]] = {}
        self._hierarchy_cache: dict[uuid.UUID, tuple[ImpactHierarchyRefDTO, ...]] = {}

    async def handle(self, query: Query) -> ArtifactImpactAnalysisResultDTO:
        assert isinstance(query, GetArtifactImpactAnalysis)

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")

        direction = (query.direction or "both").strip().lower()
        if direction not in {"both", "from", "to"}:
            raise ValidationError("direction must be one of: both, from, to")

        depth = max(0, min(query.depth, MAX_IMPACT_DEPTH))
        relationship_types = self._normalize_relationship_types(query.relationship_types)

        focus_artifact = await self._artifact_repo.find_by_id(query.artifact_id)
        if focus_artifact is None or focus_artifact.project_id != query.project_id:
            raise ValidationError("Artifact not found")
        self._artifact_cache[focus_artifact.id] = focus_artifact

        trace_from: list[ArtifactImpactAnalysisNodeDTO] = []
        trace_to: list[ArtifactImpactAnalysisNodeDTO] = []
        if direction in {"both", "from"}:
            trace_from = await self._build_trace(
                focus_artifact.id,
                query.project_id,
                relationship_types,
                depth,
                direction="incoming",
                include_hierarchy=query.include_hierarchy,
                manifest_bundle=query.manifest_bundle,
                path={focus_artifact.id},
            )
        if direction in {"both", "to"}:
            trace_to = await self._build_trace(
                focus_artifact.id,
                query.project_id,
                relationship_types,
                depth,
                direction="outgoing",
                include_hierarchy=query.include_hierarchy,
                manifest_bundle=query.manifest_bundle,
                path={focus_artifact.id},
            )

        return ArtifactImpactAnalysisResultDTO(
            focus_artifact=self._to_artifact_dto(focus_artifact),
            trace_from=trace_from,
            trace_to=trace_to,
            applied_relationship_types=relationship_types,
            depth=depth,
        )

    @staticmethod
    def _normalize_relationship_types(values: tuple[str, ...]) -> tuple[str, ...]:
        normalized: list[str] = []
        for value in values or DEFAULT_IMPACT_RELATIONSHIP_TYPES:
            item = str(value or "").strip().lower()
            if item and item not in normalized:
                normalized.append(item)
        return tuple(normalized or DEFAULT_IMPACT_RELATIONSHIP_TYPES)

    async def _build_trace(
        self,
        artifact_id: uuid.UUID,
        project_id: uuid.UUID,
        relationship_types: tuple[str, ...],
        remaining_depth: int,
        *,
        direction: str,
        include_hierarchy: bool,
        manifest_bundle: dict | None,
        path: set[uuid.UUID],
    ) -> list[ArtifactImpactAnalysisNodeDTO]:
        relationships = await self._load_relationships(
            project_id,
            artifact_id,
            relationship_types,
            direction=direction,
        )
        nodes: list[ArtifactImpactAnalysisNodeDTO] = []
        for relationship in relationships:
            next_id = (
                relationship.source_artifact_id
                if direction == "incoming"
                else relationship.target_artifact_id
            )
            if next_id in path:
                continue
            next_artifact = await self._get_artifact(project_id, next_id)
            if next_artifact is None:
                continue
            child_path = set(path)
            child_path.add(next_id)
            children: list[ArtifactImpactAnalysisNodeDTO] = []
            if remaining_depth > 1:
                children = await self._build_trace(
                    next_id,
                    project_id,
                    relationship_types,
                    remaining_depth - 1,
                    direction=direction,
                    include_hierarchy=include_hierarchy,
                    manifest_bundle=manifest_bundle,
                    path=child_path,
                )
            has_more = False
            if remaining_depth == 1:
                has_more = await self._has_more_relationships(
                    project_id,
                    next_id,
                    relationship_types,
                    direction=direction,
                    exclude_ids=child_path,
                )
            rel_type = get_relationship_type(manifest_bundle, relationship.relationship_type)
            nodes.append(
                ArtifactImpactAnalysisNodeDTO(
                    artifact_id=next_artifact.id,
                    artifact_key=next_artifact.artifact_key,
                    artifact_type=next_artifact.artifact_type,
                    title=next_artifact.title,
                    state=next_artifact.state,
                    parent_id=next_artifact.parent_id,
                    relationship_id=relationship.id,
                    relationship_type=relationship.relationship_type,
                    relationship_label=(
                        rel_type.reverse_label if direction == "incoming" else rel_type.forward_label
                    ),
                    direction=direction,
                    depth=len(path),
                    has_more=has_more,
                    hierarchy_path=(
                        await self._get_hierarchy_path(project_id, next_artifact.id)
                        if include_hierarchy
                        else ()
                    ),
                    children=children,
                )
            )
        return nodes

    async def _load_relationships(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        relationship_types: tuple[str, ...],
        *,
        direction: str,
    ) -> list[Relationship]:
        if direction == "outgoing":
            cached = self._outgoing_cache.get(artifact_id)
            if cached is None:
                cached = await self._relationship_repo.list_outgoing_relationships_from_artifacts(
                    project_id,
                    [artifact_id],
                )
                self._outgoing_cache[artifact_id] = cached
            return [rel for rel in cached if rel.relationship_type in relationship_types]

        key = (artifact_id, relationship_types)
        cached = self._incoming_cache.get(key)
        if cached is None:
            cached = await self._relationship_repo.list_relationships_to_artifacts(
                project_id,
                [artifact_id],
                list(relationship_types),
            )
            self._incoming_cache[key] = cached
        return cached

    async def _has_more_relationships(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
        relationship_types: tuple[str, ...],
        *,
        direction: str,
        exclude_ids: set[uuid.UUID],
    ) -> bool:
        relationships = await self._load_relationships(
            project_id,
            artifact_id,
            relationship_types,
            direction=direction,
        )
        for relationship in relationships:
            next_id = (
                relationship.source_artifact_id
                if direction == "incoming"
                else relationship.target_artifact_id
            )
            if next_id not in exclude_ids:
                return True
        return False

    async def _get_artifact(self, project_id: uuid.UUID, artifact_id: uuid.UUID) -> Artifact | None:
        cached = self._artifact_cache.get(artifact_id)
        if cached is not None:
            return cached
        loaded = await self._artifact_repo.list_by_ids_in_project(project_id, [artifact_id])
        if not loaded:
            return None
        self._artifact_cache[artifact_id] = loaded[0]
        return loaded[0]

    async def _get_hierarchy_path(
        self,
        project_id: uuid.UUID,
        artifact_id: uuid.UUID,
    ) -> tuple[ImpactHierarchyRefDTO, ...]:
        cached = self._hierarchy_cache.get(artifact_id)
        if cached is not None:
            return cached
        current = await self._get_artifact(project_id, artifact_id)
        refs: list[ImpactHierarchyRefDTO] = []
        seen: set[uuid.UUID] = set()
        while current is not None and current.parent_id is not None and current.parent_id not in seen:
            seen.add(current.parent_id)
            parent = await self._get_artifact(project_id, current.parent_id)
            if parent is None:
                break
            refs.append(
                ImpactHierarchyRefDTO(
                    id=parent.id,
                    artifact_key=parent.artifact_key,
                    title=parent.title,
                    artifact_type=parent.artifact_type,
                )
            )
            current = parent
        refs.reverse()
        result = tuple(refs)
        self._hierarchy_cache[artifact_id] = result
        return result

    @staticmethod
    def _to_artifact_dto(artifact: Artifact) -> ArtifactDTO:
        return ArtifactDTO(
            id=artifact.id,
            project_id=artifact.project_id,
            artifact_type=artifact.artifact_type,
            title=artifact.title,
            description=artifact.description,
            state=artifact.state,
            assignee_id=artifact.assignee_id,
            parent_id=artifact.parent_id,
            custom_fields=artifact.custom_fields,
            artifact_key=artifact.artifact_key,
            state_reason=artifact.state_reason,
            resolution=artifact.resolution,
            rank_order=artifact.rank_order,
            cycle_id=artifact.cycle_id,
            area_node_id=artifact.area_node_id,
            area_path_snapshot=artifact.area_path_snapshot,
            team_id=artifact.team_id,
            created_at=artifact.created_at,
            updated_at=artifact.updated_at,
            stale_traceability=getattr(artifact, "stale_traceability", False),
            stale_traceability_reason=getattr(artifact, "stale_traceability_reason", None),
            stale_traceability_at=getattr(artifact, "stale_traceability_at", None),
            tags=(),
        )
