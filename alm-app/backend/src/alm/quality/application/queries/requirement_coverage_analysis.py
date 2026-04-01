"""Requirement tree coverage: verifies links + last execution rollups."""

from __future__ import annotations

import threading
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from alm.artifact.domain.fulltext_config import resolve_fulltext_regconfig
from alm.artifact.domain.manifest_merge_defaults import merge_manifest_metadata_defaults
from alm.artifact.domain.manifest_workflow_metadata import (
    resolve_system_root_artifact_types,
    resolve_tree_root_artifact_type,
)
from alm.artifact.domain.ports import ArtifactRepository
from alm.config.settings import settings
from alm.process_template.domain.ports import ProcessTemplateRepository
from alm.project.domain.ports import ProjectRepository
from alm.quality.application.queries.batch_last_test_execution_status import (
    BatchLastTestExecutionStatus,
    BatchLastTestExecutionStatusHandler,
    LastTestExecutionStatusDTO,
)
from alm.quality.application.requirement_coverage_rollups import (
    COVERAGE_BUCKETS,
    CoverageBucket,
    accumulate_subtree_counts_for_leaves,
    worst_status_among_tests,
)
from alm.relationship.domain.ports import RelationshipRepository
from alm.relationship.domain.types import VERIFIES
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError

MAX_COVERAGE_ARTIFACTS_WITHOUT_UNDER = 650
MAX_COVERAGE_SUBTREE_NODES = 2400
LINK_QUERY_CHUNK = 450
TEST_STATUS_CHUNK = 200
_CACHE_TTL_SEC = 90.0


@dataclass(frozen=True)
class RequirementCoverageAnalysis(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    under_artifact_id: uuid.UUID | None = None
    relationship_types: tuple[str, ...] = (VERIFIES,)
    include_reverse_verifies: bool = True
    scope_run_id: uuid.UUID | None = None
    scope_suite_id: uuid.UUID | None = None
    scope_campaign_id: uuid.UUID | None = None
    refresh: bool = False


@dataclass
class RequirementCoverageNodeDTO:
    id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    artifact_key: str | None
    artifact_type: str
    direct_status: str
    subtree_counts: dict[str, int]


@dataclass
class RequirementCoverageTestRefDTO:
    test_id: uuid.UUID
    status: str | None
    run_id: uuid.UUID | None
    run_title: str | None


@dataclass
class RequirementCoverageLeafDTO:
    id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    artifact_key: str | None
    leaf_status: str
    verifying_test_ids: list[uuid.UUID]
    tests: list[RequirementCoverageTestRefDTO]


@dataclass
class RequirementCoverageAnalysisResult:
    computed_at: datetime
    cache_hit: bool
    nodes: list[RequirementCoverageNodeDTO]
    leaves: list[RequirementCoverageLeafDTO]


_coverage_cache: dict[str, tuple[float, RequirementCoverageAnalysisResult]] = {}
_coverage_lock = threading.Lock()


def _cache_get(key: str) -> RequirementCoverageAnalysisResult | None:
    now = time.monotonic()
    with _coverage_lock:
        hit = _coverage_cache.get(key)
        if not hit:
            return None
        exp, val = hit
        if now >= exp:
            del _coverage_cache[key]
            return None
        return val


def _cache_set(key: str, val: RequirementCoverageAnalysisResult) -> None:
    with _coverage_lock:
        _coverage_cache[key] = (time.monotonic() + _CACHE_TTL_SEC, val)


def _cache_key(q: RequirementCoverageAnalysis) -> str:
    lt = ",".join(sorted(q.relationship_types))
    return "|".join(
        [
            str(q.project_id),
            str(q.under_artifact_id or ""),
            lt,
            str(q.include_reverse_verifies),
            str(q.scope_run_id or ""),
            str(q.scope_suite_id or ""),
            str(q.scope_campaign_id or ""),
        ]
    )


class RequirementCoverageAnalysisHandler(QueryHandler[RequirementCoverageAnalysisResult]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        artifact_repo: ArtifactRepository,
        relationship_repo: RelationshipRepository,
        process_template_repo: ProcessTemplateRepository,
    ) -> None:
        self._project_repo = project_repo
        self._artifact_repo = artifact_repo
        self._relationship_repo = relationship_repo
        self._process_template_repo = process_template_repo

    async def handle(self, query: Query) -> RequirementCoverageAnalysisResult:
        assert isinstance(query, RequirementCoverageAnalysis)
        scope_n = sum(
            1
            for x in (query.scope_run_id, query.scope_suite_id, query.scope_campaign_id)
            if x is not None
        )
        if scope_n > 1:
            raise ValidationError("At most one of scope_run_id, scope_suite_id, scope_campaign_id")

        ck = _cache_key(query)
        if not query.refresh:
            cached = _cache_get(ck)
            if cached is not None:
                return RequirementCoverageAnalysisResult(
                    computed_at=cached.computed_at,
                    cache_hit=True,
                    nodes=cached.nodes,
                    leaves=cached.leaves,
                )

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")

        manifest_bundle: dict[str, Any] = {}
        if project.process_template_version_id:
            version = await self._process_template_repo.find_version_by_id(
                project.process_template_version_id
            )
            if version and version.manifest_bundle:
                manifest_bundle = merge_manifest_metadata_defaults(version.manifest_bundle)

        fts_cfg = resolve_fulltext_regconfig(manifest_bundle, settings.fulltext_search_config)
        system_roots = resolve_system_root_artifact_types(manifest_bundle)
        root_type = resolve_tree_root_artifact_type("requirement", manifest_bundle)
        if not root_type:
            raise ValidationError("Project manifest has no requirement tree root")

        roots = await self._artifact_repo.list_by_project(
            query.project_id,
            type_filter=root_type,
            limit=1,
            fts_regconfig=fts_cfg,
        )
        if not roots:
            result = RequirementCoverageAnalysisResult(
                computed_at=datetime.now(UTC),
                cache_hit=False,
                nodes=[],
                leaves=[],
            )
            _cache_set(ck, result)
            return result

        root_artifact_id = roots[0].id

        full_tree_total = await self._artifact_repo.count_by_project(
            query.project_id,
            root_artifact_id=root_artifact_id,
            exclude_root_artifact_types=True,
            root_type_ids_exclude=system_roots,
            fts_regconfig=fts_cfg,
        )
        if full_tree_total > MAX_COVERAGE_ARTIFACTS_WITHOUT_UNDER and query.under_artifact_id is None:
            raise ValidationError(
                "Requirement tree is too large for project-wide coverage. "
                f"Pass under=<artifact_id> to analyze a subtree (>{MAX_COVERAGE_ARTIFACTS_WITHOUT_UNDER} items)."
            )

        if query.under_artifact_id is not None:
            under_art = await self._artifact_repo.find_by_id(query.under_artifact_id)
            if under_art is None or under_art.project_id != query.project_id:
                raise ValidationError("under_artifact_id not found in this project")
            effective_root = query.under_artifact_id
        else:
            effective_root = root_artifact_id

        subtree_total = await self._artifact_repo.count_by_project(
            query.project_id,
            root_artifact_id=effective_root,
            exclude_root_artifact_types=True,
            root_type_ids_exclude=system_roots,
            fts_regconfig=fts_cfg,
        )
        if subtree_total > MAX_COVERAGE_SUBTREE_NODES:
            raise ValidationError(
                f"Subtree too large (max {MAX_COVERAGE_SUBTREE_NODES}). Choose a deeper under root."
            )

        artifacts = await self._artifact_repo.list_by_project(
            query.project_id,
            sort_by="title",
            sort_order="asc",
            limit=subtree_total if subtree_total > 0 else None,
            root_artifact_id=effective_root,
            exclude_root_artifact_types=True,
            root_type_ids_exclude=system_roots,
            fts_regconfig=fts_cfg,
        )

        by_id = {a.id: a for a in artifacts}
        nodes_cover = [a for a in artifacts if a.artifact_type != "root-requirement"]
        node_ids = {a.id for a in nodes_cover}

        children: dict[uuid.UUID, list[uuid.UUID]] = {n: [] for n in node_ids}
        for a in nodes_cover:
            if a.parent_id is not None and a.parent_id in node_ids:
                children[a.parent_id].append(a.id)

        leaf_ids = {n for n in node_ids if not children[n]}
        parent_by_id = {a.id: a.parent_id for a in nodes_cover}

        relationship_types = list(query.relationship_types) if query.relationship_types else ["verifies"]
        req_ids_list = list(node_ids)

        tests_by_req: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
        for i in range(0, len(req_ids_list), LINK_QUERY_CHUNK):
            chunk = req_ids_list[i : i + LINK_QUERY_CHUNK]
            links_in = await self._relationship_repo.list_relationships_to_artifacts(
                query.project_id, chunk, relationship_types
            )
            for ln in links_in:
                tests_by_req[ln.target_artifact_id].add(ln.source_artifact_id)

        if query.include_reverse_verifies:
            for i in range(0, len(req_ids_list), LINK_QUERY_CHUNK):
                chunk = req_ids_list[i : i + LINK_QUERY_CHUNK]
                out_links = await self._relationship_repo.list_outgoing_relationships_from_artifacts(
                    query.project_id, chunk
                )
                cand_tos: list[uuid.UUID] = []
                for ln in out_links:
                    if ln.relationship_type not in relationship_types:
                        continue
                    cand_tos.append(ln.target_artifact_id)
                if not cand_tos:
                    continue
                uniq = list({x for x in cand_tos})
                arts = await self._artifact_repo.list_by_ids_in_project(query.project_id, uniq)
                test_ids = {a.id for a in arts if a.artifact_type == "test-case"}
                for ln in out_links:
                    if ln.relationship_type not in relationship_types:
                        continue
                    if ln.target_artifact_id in test_ids:
                        tests_by_req[ln.source_artifact_id].add(ln.target_artifact_id)

        all_test_ids = list({t for s in tests_by_req.values() for t in s})

        batch_handler = BatchLastTestExecutionStatusHandler(
            project_repo=self._project_repo,
            artifact_repo=self._artifact_repo,
            relationship_repo=self._relationship_repo,
        )
        status_by_test: dict[uuid.UUID, LastTestExecutionStatusDTO] = {}
        for i in range(0, len(all_test_ids), TEST_STATUS_CHUNK):
            chunk = all_test_ids[i : i + TEST_STATUS_CHUNK]
            rows = await batch_handler.handle(
                BatchLastTestExecutionStatus(
                    tenant_id=query.tenant_id,
                    project_id=query.project_id,
                    test_ids=chunk,
                    scope_run_id=query.scope_run_id,
                    scope_suite_id=query.scope_suite_id,
                    scope_campaign_id=query.scope_campaign_id,
                )
            )
            for row in rows:
                status_by_test[row.test_id] = row

        def _direct_for_tests(tids: set[uuid.UUID]) -> CoverageBucket:
            if not tids:
                return "not_covered"
            stats = [status_by_test.get(t).status if t in status_by_test else None for t in tids]
            return worst_status_among_tests(stats)

        direct_by_node: dict[uuid.UUID, CoverageBucket] = {}
        for nid in node_ids:
            direct_by_node[nid] = _direct_for_tests(tests_by_req.get(nid, set()))

        leaf_status: dict[uuid.UUID, CoverageBucket] = {
            lid: direct_by_node.get(lid, "not_covered") for lid in leaf_ids
        }

        subtree_map = accumulate_subtree_counts_for_leaves(
            node_ids, leaf_ids, leaf_status, parent_by_id
        )

        nodes_out: list[RequirementCoverageNodeDTO] = []
        for a in sorted(nodes_cover, key=lambda x: (str(x.title or ""), str(x.id))):
            sc = subtree_map.get(a.id, {b: 0 for b in COVERAGE_BUCKETS})
            # ensure all keys present
            full_sc = {b: int(sc.get(b, 0)) for b in COVERAGE_BUCKETS}
            nodes_out.append(
                RequirementCoverageNodeDTO(
                    id=a.id,
                    parent_id=a.parent_id,
                    title=a.title,
                    artifact_key=a.artifact_key,
                    artifact_type=a.artifact_type,
                    direct_status=direct_by_node.get(a.id, "not_covered"),
                    subtree_counts=full_sc,
                )
            )

        leaves_out: list[RequirementCoverageLeafDTO] = []
        for lid in sorted(leaf_ids, key=lambda x: str(x)):
            art = by_id.get(lid)
            if art is None:
                continue
            tset = tests_by_req.get(lid, set())
            tests_rows: list[RequirementCoverageTestRefDTO] = []
            for tid in sorted(tset, key=str):
                dto = status_by_test.get(tid)
                tests_rows.append(
                    RequirementCoverageTestRefDTO(
                        test_id=tid,
                        status=dto.status if dto else None,
                        run_id=dto.run_id if dto else None,
                        run_title=dto.run_title if dto else None,
                    )
                )
            leaves_out.append(
                RequirementCoverageLeafDTO(
                    id=lid,
                    parent_id=art.parent_id,
                    title=art.title,
                    artifact_key=art.artifact_key,
                    leaf_status=leaf_status.get(lid, "not_covered"),
                    verifying_test_ids=sorted(tset, key=lambda x: str(x)),
                    tests=tests_rows,
                )
            )

        computed = datetime.now(UTC)
        result = RequirementCoverageAnalysisResult(
            computed_at=computed,
            cache_hit=False,
            nodes=nodes_out,
            leaves=leaves_out,
        )
        _cache_set(ck, result)
        return result
