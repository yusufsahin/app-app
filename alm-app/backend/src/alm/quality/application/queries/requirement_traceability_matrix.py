"""Requirement x test traceability matrix with scoped last execution."""

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
from alm.relationship.domain.ports import RelationshipRepository
from alm.relationship.domain.types import VERIFIES
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError

MAX_MATRIX_ARTIFACTS_WITHOUT_UNDER = 400
MAX_MATRIX_SUBTREE_NODES = 1200
MAX_MATRIX_ROWS = 250
MAX_MATRIX_COLUMNS = 180
LINK_QUERY_CHUNK = 450
TEST_STATUS_CHUNK = 200
_CACHE_TTL_SEC = 90.0


@dataclass(frozen=True)
class RequirementTraceabilityMatrix(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    under_artifact_id: uuid.UUID | None = None
    relationship_types: tuple[str, ...] = (VERIFIES,)
    include_reverse_verifies: bool = True
    scope_run_id: uuid.UUID | None = None
    scope_suite_id: uuid.UUID | None = None
    scope_campaign_id: uuid.UUID | None = None
    search: str | None = None
    refresh: bool = False


@dataclass
class TraceabilityMatrixColumnDTO:
    test_id: uuid.UUID
    artifact_key: str | None
    title: str


@dataclass
class TraceabilityMatrixCellDTO:
    test_id: uuid.UUID
    linked: bool
    status: str | None
    run_id: uuid.UUID | None
    run_title: str | None


@dataclass
class TraceabilityMatrixRowDTO:
    requirement_id: uuid.UUID
    parent_id: uuid.UUID | None
    artifact_key: str | None
    title: str
    cells: list[TraceabilityMatrixCellDTO]


@dataclass
class TraceabilityRelationshipDTO:
    requirement_id: uuid.UUID
    requirement_parent_id: uuid.UUID | None
    requirement_artifact_key: str | None
    requirement_title: str
    test_id: uuid.UUID
    test_artifact_key: str | None
    test_title: str
    relationship_type: str
    status: str | None
    run_id: uuid.UUID | None
    run_title: str | None


@dataclass
class RequirementTraceabilityMatrixResult:
    computed_at: datetime
    cache_hit: bool
    rows: list[TraceabilityMatrixRowDTO]
    columns: list[TraceabilityMatrixColumnDTO]
    relationships: list[TraceabilityRelationshipDTO]
    truncated: bool = False


@dataclass(frozen=True)
class RequirementTraceabilityMatrixSummary(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    under_artifact_id: uuid.UUID | None = None
    relationship_types: tuple[str, ...] = (VERIFIES,)
    include_reverse_verifies: bool = True
    scope_run_id: uuid.UUID | None = None
    scope_suite_id: uuid.UUID | None = None
    scope_campaign_id: uuid.UUID | None = None
    search: str | None = None
    refresh: bool = False


@dataclass
class TraceabilityMatrixSummaryChildDTO:
    artifact_id: uuid.UUID
    parent_id: uuid.UUID | None
    artifact_key: str | None
    title: str
    subtree_node_count: int
    requirement_row_count: int
    relationship_count: int
    distinct_test_count: int


@dataclass
class RequirementTraceabilityMatrixSummaryResult:
    computed_at: datetime
    cache_hit: bool
    project_node_count: int
    subtree_node_count: int
    candidate_requirement_row_count: int
    distinct_test_count: int
    relationship_count: int
    can_render_matrix: bool
    exceeds_project_without_under_limit: bool
    exceeds_subtree_limit: bool
    exceeds_row_limit: bool
    exceeds_column_limit: bool
    applied_search: str | None
    child_subtrees: list[TraceabilityMatrixSummaryChildDTO]


_matrix_cache: dict[str, tuple[float, RequirementTraceabilityMatrixResult]] = {}
_summary_cache: dict[str, tuple[float, RequirementTraceabilityMatrixSummaryResult]] = {}
_matrix_lock = threading.Lock()


def _cache_get(key: str) -> RequirementTraceabilityMatrixResult | None:
    now = time.monotonic()
    with _matrix_lock:
        hit = _matrix_cache.get(key)
        if not hit:
            return None
        exp, val = hit
        if now >= exp:
            del _matrix_cache[key]
            return None
        return val


def _summary_cache_get(key: str) -> RequirementTraceabilityMatrixSummaryResult | None:
    now = time.monotonic()
    with _matrix_lock:
        hit = _summary_cache.get(key)
        if not hit:
            return None
        exp, val = hit
        if now >= exp:
            del _summary_cache[key]
            return None
        return val


def _cache_set(key: str, val: RequirementTraceabilityMatrixResult) -> None:
    with _matrix_lock:
        _matrix_cache[key] = (time.monotonic() + _CACHE_TTL_SEC, val)


def _summary_cache_set(key: str, val: RequirementTraceabilityMatrixSummaryResult) -> None:
    with _matrix_lock:
        _summary_cache[key] = (time.monotonic() + _CACHE_TTL_SEC, val)


def _cache_key(q: RequirementTraceabilityMatrix) -> str:
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
            (q.search or "").strip().lower(),
        ]
    )


def _summary_cache_key(q: RequirementTraceabilityMatrixSummary) -> str:
    lt = ",".join(sorted(q.relationship_types))
    return "|".join(
        [
            "summary",
            str(q.project_id),
            str(q.under_artifact_id or ""),
            lt,
            str(q.include_reverse_verifies),
            str(q.scope_run_id or ""),
            str(q.scope_suite_id or ""),
            str(q.scope_campaign_id or ""),
            (q.search or "").strip().lower(),
        ]
    )


def _search_matches(search_text: str | None, values: list[str | None]) -> bool:
    term = (search_text or "").strip().lower()
    if not term:
        return True
    haystack = " ".join(v.strip().lower() for v in values if v and v.strip())
    return term in haystack


@dataclass
class _MatrixPreparedContext:
    project: Any
    fts_cfg: str
    system_roots: set[str]
    effective_root: uuid.UUID
    root_artifact_id: uuid.UUID
    full_tree_total: int
    subtree_total: int
    artifacts: list[Any]
    relationship_types: list[str]


async def _prepare_matrix_context(
    *,
    project_repo: ProjectRepository,
    artifact_repo: ArtifactRepository,
    process_template_repo: ProcessTemplateRepository,
    query: RequirementTraceabilityMatrix | RequirementTraceabilityMatrixSummary,
) -> _MatrixPreparedContext:
    project = await project_repo.find_by_id(query.project_id)
    if project is None or project.tenant_id != query.tenant_id:
        raise ValidationError("Project not found")

    manifest_bundle: dict[str, Any] = {}
    if project.process_template_version_id:
        version = await process_template_repo.find_version_by_id(project.process_template_version_id)
        if version and version.manifest_bundle:
            manifest_bundle = merge_manifest_metadata_defaults(version.manifest_bundle)

    fts_cfg = resolve_fulltext_regconfig(manifest_bundle, settings.fulltext_search_config)
    system_roots = resolve_system_root_artifact_types(manifest_bundle)
    root_type = resolve_tree_root_artifact_type("requirement", manifest_bundle)
    if not root_type:
        raise ValidationError("Project manifest has no requirement tree root")

    roots = await artifact_repo.list_by_project(
        query.project_id,
        type_filter=root_type,
        limit=1,
        fts_regconfig=fts_cfg,
    )
    if not roots:
        return _MatrixPreparedContext(
            project=project,
            fts_cfg=fts_cfg,
            system_roots=system_roots,
            effective_root=uuid.uuid4(),
            root_artifact_id=uuid.uuid4(),
            full_tree_total=0,
            subtree_total=0,
            artifacts=[],
            relationship_types=list(query.relationship_types) if query.relationship_types else ["verifies"],
        )

    root_artifact_id = roots[0].id
    full_tree_total = await artifact_repo.count_by_project(
        query.project_id,
        root_artifact_id=root_artifact_id,
        exclude_root_artifact_types=True,
        root_type_ids_exclude=system_roots,
        fts_regconfig=fts_cfg,
    )

    if query.under_artifact_id is not None:
        under_art = await artifact_repo.find_by_id(query.under_artifact_id)
        if under_art is None or under_art.project_id != query.project_id:
            raise ValidationError("under_artifact_id not found in this project")
        effective_root = query.under_artifact_id
    else:
        effective_root = root_artifact_id

    subtree_total = await artifact_repo.count_by_project(
        query.project_id,
        root_artifact_id=effective_root,
        exclude_root_artifact_types=True,
        root_type_ids_exclude=system_roots,
        fts_regconfig=fts_cfg,
    )
    artifacts = await artifact_repo.list_by_project(
        query.project_id,
        sort_by="title",
        sort_order="asc",
        limit=subtree_total if subtree_total > 0 else None,
        root_artifact_id=effective_root,
        exclude_root_artifact_types=True,
        root_type_ids_exclude=system_roots,
        fts_regconfig=fts_cfg,
    )
    return _MatrixPreparedContext(
        project=project,
        fts_cfg=fts_cfg,
        system_roots=system_roots,
        effective_root=effective_root,
        root_artifact_id=root_artifact_id,
        full_tree_total=full_tree_total,
        subtree_total=subtree_total,
        artifacts=artifacts,
        relationship_types=list(query.relationship_types) if query.relationship_types else ["verifies"],
    )


class RequirementTraceabilityMatrixHandler(
    QueryHandler[RequirementTraceabilityMatrixResult]
):
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

    async def handle(self, query: Query) -> RequirementTraceabilityMatrixResult:
        assert isinstance(query, RequirementTraceabilityMatrix)
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
                return RequirementTraceabilityMatrixResult(
                    computed_at=cached.computed_at,
                    cache_hit=True,
                    rows=cached.rows,
                    columns=cached.columns,
                    relationships=cached.relationships,
                    truncated=cached.truncated,
                )
        ctx = await _prepare_matrix_context(
            project_repo=self._project_repo,
            artifact_repo=self._artifact_repo,
            process_template_repo=self._process_template_repo,
            query=query,
        )
        if ctx.full_tree_total == 0 and not ctx.artifacts:
            result = RequirementTraceabilityMatrixResult(
                computed_at=datetime.now(UTC),
                cache_hit=False,
                rows=[],
                columns=[],
                relationships=[],
                truncated=False,
            )
            _cache_set(ck, result)
            return result
        if (
            ctx.full_tree_total > MAX_MATRIX_ARTIFACTS_WITHOUT_UNDER
            and query.under_artifact_id is None
        ):
            raise ValidationError(
                "Requirement tree is too large for project-wide traceability matrix. "
                f"Pass under=<artifact_id> to analyze a subtree (>{MAX_MATRIX_ARTIFACTS_WITHOUT_UNDER} items)."
            )
        if ctx.subtree_total > MAX_MATRIX_SUBTREE_NODES:
            raise ValidationError(
                f"Subtree too large for matrix (max {MAX_MATRIX_SUBTREE_NODES}). Choose a deeper under root."
            )
        nodes_cover = [a for a in ctx.artifacts if a.artifact_type != "root-requirement"]
        node_ids = {a.id for a in nodes_cover}
        children: dict[uuid.UUID, list[uuid.UUID]] = {n: [] for n in node_ids}
        for a in nodes_cover:
            if a.parent_id is not None and a.parent_id in node_ids:
                children[a.parent_id].append(a.id)
        leaf_ids = {n for n in node_ids if not children[n]}
        leaf_artifacts = [a for a in nodes_cover if a.id in leaf_ids]

        relationship_types = ctx.relationship_types
        req_ids_list = list(leaf_ids)
        tests_by_req: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
        relationship_type_by_pair: dict[tuple[uuid.UUID, uuid.UUID], str] = {}

        for i in range(0, len(req_ids_list), LINK_QUERY_CHUNK):
            chunk = req_ids_list[i : i + LINK_QUERY_CHUNK]
            links_in = await self._relationship_repo.list_relationships_to_artifacts(
                query.project_id, chunk, relationship_types
            )
            for ln in links_in:
                tests_by_req[ln.target_artifact_id].add(ln.source_artifact_id)
                relationship_type_by_pair[(ln.target_artifact_id, ln.source_artifact_id)] = ln.relationship_type

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
                        relationship_type_by_pair[(ln.source_artifact_id, ln.target_artifact_id)] = ln.relationship_type

        # Drop empty rows early so the matrix stays requirement-leaf oriented and bounded.
        candidate_leafs = [a for a in leaf_artifacts if tests_by_req.get(a.id)]
        if len(candidate_leafs) > MAX_MATRIX_ROWS:
            raise ValidationError(
                f"Matrix row count too large (max {MAX_MATRIX_ROWS}). Choose a deeper under root."
            )

        all_test_ids = list({t for s in tests_by_req.values() for t in s})
        if len(all_test_ids) > MAX_MATRIX_COLUMNS:
            raise ValidationError(
                f"Matrix column count too large (max {MAX_MATRIX_COLUMNS}). Narrow scope or search."
            )

        test_artifacts = await self._artifact_repo.list_by_ids_in_project(
            query.project_id, all_test_ids
        )
        test_artifact_by_id = {
            a.id: a for a in test_artifacts if a.artifact_type == "test-case"
        }

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

        search = query.search.strip() if query.search else ""
        filtered_leafs = []
        filtered_test_ids: set[uuid.UUID] = set()
        for art in sorted(candidate_leafs, key=lambda x: (str(x.title or ""), str(x.id))):
            tids = tests_by_req.get(art.id, set())
            matched_tests = {
                tid
                for tid in tids
                if _search_matches(
                    search,
                    [
                        art.title,
                        art.artifact_key,
                        test_artifact_by_id.get(tid).title if tid in test_artifact_by_id else None,
                        test_artifact_by_id.get(tid).artifact_key
                        if tid in test_artifact_by_id
                        else None,
                    ],
                )
            }
            row_matches = _search_matches(search, [art.title, art.artifact_key])
            if search and not row_matches and not matched_tests:
                continue
            visible_tests = tids if row_matches or not search else matched_tests
            filtered_leafs.append((art, visible_tests))
            filtered_test_ids.update(visible_tests)

        if len(filtered_leafs) > MAX_MATRIX_ROWS:
            raise ValidationError(
                f"Matrix row count too large after filtering (max {MAX_MATRIX_ROWS})."
            )
        if len(filtered_test_ids) > MAX_MATRIX_COLUMNS:
            raise ValidationError(
                f"Matrix column count too large after filtering (max {MAX_MATRIX_COLUMNS})."
            )

        columns = sorted(
            [
                TraceabilityMatrixColumnDTO(
                    test_id=tid,
                    artifact_key=test_artifact_by_id.get(tid).artifact_key
                    if tid in test_artifact_by_id
                    else None,
                    title=test_artifact_by_id.get(tid).title
                    if tid in test_artifact_by_id
                    else str(tid),
                )
                for tid in filtered_test_ids
            ],
            key=lambda x: ((x.artifact_key or "").lower(), x.title.lower(), str(x.test_id)),
        )
        column_ids = {c.test_id for c in columns}

        rows_out: list[TraceabilityMatrixRowDTO] = []
        relationships: list[TraceabilityRelationshipDTO] = []
        for art, visible_test_ids in filtered_leafs:
            cells: list[TraceabilityMatrixCellDTO] = []
            for tid in sorted(
                [tid for tid in visible_test_ids if tid in column_ids],
                key=lambda item: (
                    (test_artifact_by_id.get(item).artifact_key or "").lower()
                    if item in test_artifact_by_id
                    else "",
                    test_artifact_by_id.get(item).title.lower()
                    if item in test_artifact_by_id
                    else str(item),
                    str(item),
                ),
            ):
                dto = status_by_test.get(tid)
                cells.append(
                    TraceabilityMatrixCellDTO(
                        test_id=tid,
                        linked=True,
                        status=dto.status if dto else None,
                        run_id=dto.run_id if dto else None,
                        run_title=dto.run_title if dto else None,
                    )
                )
                relationships.append(
                    TraceabilityRelationshipDTO(
                        requirement_id=art.id,
                        requirement_parent_id=art.parent_id,
                        requirement_artifact_key=art.artifact_key,
                        requirement_title=art.title,
                        test_id=tid,
                        test_artifact_key=test_artifact_by_id.get(tid).artifact_key
                        if tid in test_artifact_by_id
                        else None,
                        test_title=test_artifact_by_id.get(tid).title
                        if tid in test_artifact_by_id
                        else str(tid),
                        relationship_type=relationship_type_by_pair.get((art.id, tid), "verifies"),
                        status=dto.status if dto else None,
                        run_id=dto.run_id if dto else None,
                        run_title=dto.run_title if dto else None,
                    )
                )
            rows_out.append(
                TraceabilityMatrixRowDTO(
                    requirement_id=art.id,
                    parent_id=art.parent_id,
                    artifact_key=art.artifact_key,
                    title=art.title,
                    cells=cells,
                )
            )

        computed = datetime.now(UTC)
        result = RequirementTraceabilityMatrixResult(
            computed_at=computed,
            cache_hit=False,
            rows=rows_out,
            columns=columns,
            relationships=sorted(
                relationships,
                key=lambda x: (
                    (x.requirement_artifact_key or "").lower(),
                    x.requirement_title.lower(),
                    (x.test_artifact_key or "").lower(),
                    x.test_title.lower(),
                ),
            ),
            truncated=False,
        )
        _cache_set(ck, result)
        return result


class RequirementTraceabilityMatrixSummaryHandler(
    QueryHandler[RequirementTraceabilityMatrixSummaryResult]
):
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

    async def handle(self, query: Query) -> RequirementTraceabilityMatrixSummaryResult:
        assert isinstance(query, RequirementTraceabilityMatrixSummary)
        scope_n = sum(
            1
            for x in (query.scope_run_id, query.scope_suite_id, query.scope_campaign_id)
            if x is not None
        )
        if scope_n > 1:
            raise ValidationError("At most one of scope_run_id, scope_suite_id, scope_campaign_id")

        ck = _summary_cache_key(query)
        if not query.refresh:
          cached = _summary_cache_get(ck)
          if cached is not None:
              return RequirementTraceabilityMatrixSummaryResult(
                  computed_at=cached.computed_at,
                  cache_hit=True,
                  project_node_count=cached.project_node_count,
                  subtree_node_count=cached.subtree_node_count,
                  candidate_requirement_row_count=cached.candidate_requirement_row_count,
                  distinct_test_count=cached.distinct_test_count,
                  relationship_count=cached.relationship_count,
                  can_render_matrix=cached.can_render_matrix,
                  exceeds_project_without_under_limit=cached.exceeds_project_without_under_limit,
                  exceeds_subtree_limit=cached.exceeds_subtree_limit,
                  exceeds_row_limit=cached.exceeds_row_limit,
                  exceeds_column_limit=cached.exceeds_column_limit,
                  applied_search=cached.applied_search,
                  child_subtrees=cached.child_subtrees,
              )

        ctx = await _prepare_matrix_context(
            project_repo=self._project_repo,
            artifact_repo=self._artifact_repo,
            process_template_repo=self._process_template_repo,
            query=query,
        )
        if ctx.full_tree_total == 0 and not ctx.artifacts:
            result = RequirementTraceabilityMatrixSummaryResult(
                computed_at=datetime.now(UTC),
                cache_hit=False,
                project_node_count=0,
                subtree_node_count=0,
                candidate_requirement_row_count=0,
                distinct_test_count=0,
                relationship_count=0,
                can_render_matrix=True,
                exceeds_project_without_under_limit=False,
                exceeds_subtree_limit=False,
                exceeds_row_limit=False,
                exceeds_column_limit=False,
                applied_search=query.search.strip() if query.search else None,
                child_subtrees=[],
            )
            _summary_cache_set(ck, result)
            return result

        nodes_cover = [a for a in ctx.artifacts if a.artifact_type != "root-requirement"]
        node_ids = {a.id for a in nodes_cover}
        children: dict[uuid.UUID, list[uuid.UUID]] = {n: [] for n in node_ids}
        for a in nodes_cover:
            if a.parent_id is not None and a.parent_id in node_ids:
                children[a.parent_id].append(a.id)
        leaf_ids = {n for n in node_ids if not children[n]}
        leaf_artifacts = [a for a in nodes_cover if a.id in leaf_ids]

        req_ids_list = list(leaf_ids)
        tests_by_req: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
        for i in range(0, len(req_ids_list), LINK_QUERY_CHUNK):
            chunk = req_ids_list[i : i + LINK_QUERY_CHUNK]
            links_in = await self._relationship_repo.list_relationships_to_artifacts(query.project_id, chunk, ctx.relationship_types)
            for ln in links_in:
                tests_by_req[ln.target_artifact_id].add(ln.source_artifact_id)

        if query.include_reverse_verifies:
            for i in range(0, len(req_ids_list), LINK_QUERY_CHUNK):
                chunk = req_ids_list[i : i + LINK_QUERY_CHUNK]
                out_links = await self._relationship_repo.list_outgoing_relationships_from_artifacts(query.project_id, chunk)
                cand_tos = [ln.target_artifact_id for ln in out_links if ln.relationship_type in ctx.relationship_types]
                if not cand_tos:
                    continue
                uniq = list({x for x in cand_tos})
                arts = await self._artifact_repo.list_by_ids_in_project(query.project_id, uniq)
                test_ids = {a.id for a in arts if a.artifact_type == "test-case"}
                for ln in out_links:
                    if ln.relationship_type in ctx.relationship_types and ln.target_artifact_id in test_ids:
                        tests_by_req[ln.source_artifact_id].add(ln.target_artifact_id)

        test_ids_all = list({tid for tids in tests_by_req.values() for tid in tids})
        test_artifact_by_id: dict[uuid.UUID, Any] = {}
        if test_ids_all:
            test_artifacts = await self._artifact_repo.list_by_ids_in_project(query.project_id, test_ids_all)
            test_artifact_by_id = {a.id: a for a in test_artifacts if a.artifact_type == "test-case"}

        search = query.search.strip() if query.search else ""
        filtered_leafs: list[tuple[Any, set[uuid.UUID]]] = []
        filtered_test_ids: set[uuid.UUID] = set()
        for art in sorted(leaf_artifacts, key=lambda x: (str(x.title or ""), str(x.id))):
            tids = tests_by_req.get(art.id, set())
            matched_tests = {
                tid
                for tid in tids
                if _search_matches(
                    search,
                    [
                        art.title,
                        art.artifact_key,
                        test_artifact_by_id.get(tid).title if tid in test_artifact_by_id else None,
                        test_artifact_by_id.get(tid).artifact_key if tid in test_artifact_by_id else None,
                    ],
                )
            }
            row_matches = _search_matches(search, [art.title, art.artifact_key])
            if search and not row_matches and not matched_tests:
                continue
            visible_tests = tids if row_matches or not search else matched_tests
            if visible_tests:
                filtered_leafs.append((art, visible_tests))
                filtered_test_ids.update(visible_tests)

        direct_children = [a for a in nodes_cover if a.parent_id == ctx.effective_root]
        child_subtrees: list[TraceabilityMatrixSummaryChildDTO] = []
        for child in sorted(direct_children, key=lambda x: ((x.artifact_key or "").lower(), x.title.lower(), str(x.id))):
            stack = [child.id]
            subtree_ids: set[uuid.UUID] = set()
            while stack:
                current = stack.pop()
                if current in subtree_ids:
                    continue
                subtree_ids.add(current)
                stack.extend(children.get(current, []))
            subtree_leaf_ids = {leaf.id for leaf in leaf_artifacts if leaf.id in subtree_ids}
            subtree_visible = [item for item in filtered_leafs if item[0].id in subtree_leaf_ids]
            subtree_tests = {tid for _, tids in subtree_visible for tid in tids}
            child_subtrees.append(
                TraceabilityMatrixSummaryChildDTO(
                    artifact_id=child.id,
                    parent_id=child.parent_id,
                    artifact_key=child.artifact_key,
                    title=child.title,
                    subtree_node_count=len(subtree_ids),
                    requirement_row_count=len(subtree_visible),
                    relationship_count=sum(len(tids) for _, tids in subtree_visible),
                    distinct_test_count=len(subtree_tests),
                )
            )

        exceeds_project_without_under_limit = (
            ctx.full_tree_total > MAX_MATRIX_ARTIFACTS_WITHOUT_UNDER and query.under_artifact_id is None
        )
        exceeds_subtree_limit = ctx.subtree_total > MAX_MATRIX_SUBTREE_NODES
        exceeds_row_limit = len(filtered_leafs) > MAX_MATRIX_ROWS
        exceeds_column_limit = len(filtered_test_ids) > MAX_MATRIX_COLUMNS
        result = RequirementTraceabilityMatrixSummaryResult(
            computed_at=datetime.now(UTC),
            cache_hit=False,
            project_node_count=ctx.full_tree_total,
            subtree_node_count=ctx.subtree_total,
            candidate_requirement_row_count=len(filtered_leafs),
            distinct_test_count=len(filtered_test_ids),
            relationship_count=sum(len(tids) for _, tids in filtered_leafs),
            can_render_matrix=not (
                exceeds_project_without_under_limit
                or exceeds_subtree_limit
                or exceeds_row_limit
                or exceeds_column_limit
            ),
            exceeds_project_without_under_limit=exceeds_project_without_under_limit,
            exceeds_subtree_limit=exceeds_subtree_limit,
            exceeds_row_limit=exceeds_row_limit,
            exceeds_column_limit=exceeds_column_limit,
            applied_search=search or None,
            child_subtrees=child_subtrees,
        )
        _summary_cache_set(ck, result)
        return result
