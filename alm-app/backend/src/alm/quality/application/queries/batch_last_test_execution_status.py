"""Batch query: last saved execution status per test case in a project."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from alm.artifact.domain.entities import Artifact
from alm.artifact.domain.ports import ArtifactRepository
from alm.artifact_link.domain.entities import ArtifactLink
from alm.artifact_link.domain.ports import ArtifactLinkRepository
from alm.project.domain.ports import ProjectRepository
from alm.quality.application.execution_linked_tests import linked_execution_test_ids_for_run
from alm.quality.application.run_metrics_v1 import (
    metrics_row_for_test_id,
    normalize_execution_status,
    step_statuses_from_metrics_row,
)
from alm.shared.application.query import Query, QueryHandler
from alm.shared.domain.exceptions import ValidationError

MAX_TEST_IDS = 200


@dataclass(frozen=True)
class BatchLastTestExecutionStatus(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    test_ids: list[uuid.UUID]
    """When set, only metrics from this test-run artifact are considered."""
    scope_run_id: uuid.UUID | None = None
    """When set (and scope_run_id is None), only runs linked via run_for_suite to this suite."""
    scope_suite_id: uuid.UUID | None = None
    """When set (and no narrower scope), only runs linked to suites under this campaign."""
    scope_campaign_id: uuid.UUID | None = None


@dataclass
class LastExecutionStepStatusDTO:
    step_id: str
    status: str


@dataclass
class LastTestExecutionStatusDTO:
    test_id: uuid.UUID
    status: str | None
    run_id: uuid.UUID | None
    run_title: str | None
    run_updated_at: Any
    param_row_index: int | None
    step_results: list[LastExecutionStepStatusDTO] = field(default_factory=list)


def _dedupe_preserve_order(ids: list[uuid.UUID]) -> list[uuid.UUID]:
    seen: set[uuid.UUID] = set()
    out: list[uuid.UUID] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def _group_outgoing_by_from(links: list[ArtifactLink]) -> dict[uuid.UUID, list[ArtifactLink]]:
    m: dict[uuid.UUID, list[ArtifactLink]] = {}
    for link in links:
        m.setdefault(link.from_artifact_id, []).append(link)
    return m


def _group_suite_includes_by_suite(links: list[ArtifactLink]) -> dict[uuid.UUID, list[ArtifactLink]]:
    m: dict[uuid.UUID, list[ArtifactLink]] = {}
    for link in links:
        m.setdefault(link.from_artifact_id, []).append(link)
    return m


class BatchLastTestExecutionStatusHandler(QueryHandler[list[LastTestExecutionStatusDTO]]):
    def __init__(
        self,
        project_repo: ProjectRepository,
        artifact_repo: ArtifactRepository,
        link_repo: ArtifactLinkRepository,
    ) -> None:
        self._project_repo = project_repo
        self._artifact_repo = artifact_repo
        self._link_repo = link_repo

    async def handle(self, query: Query) -> list[LastTestExecutionStatusDTO]:
        assert isinstance(query, BatchLastTestExecutionStatus)
        if not query.test_ids:
            return []

        ordered_unique = _dedupe_preserve_order(list(query.test_ids))
        if len(ordered_unique) > MAX_TEST_IDS:
            raise ValidationError(f"At most {MAX_TEST_IDS} test_ids allowed")

        project = await self._project_repo.find_by_id(query.project_id)
        if project is None or project.tenant_id != query.tenant_id:
            raise ValidationError("Project not found")

        if query.scope_run_id is not None:
            runs_check = await self._artifact_repo.list_by_ids_in_project(
                query.project_id, [query.scope_run_id]
            )
            if len(runs_check) != 1 or runs_check[0].artifact_type != "test-run":
                raise ValidationError("scope_run_id must be a test-run in this project")
            run_ids = [query.scope_run_id]
        else:
            candidates = await self._link_repo.list_candidate_run_test_pairs(query.project_id, ordered_unique)
            if query.scope_suite_id is not None:
                allowed = set(
                    await self._link_repo.list_run_ids_for_suite_targets(
                        query.project_id, [query.scope_suite_id]
                    )
                )
                candidates = [(r, t) for r, t in candidates if r in allowed]
            elif query.scope_campaign_id is not None:
                outgoing = await self._link_repo.list_outgoing_links_from_artifacts(
                    query.project_id, [query.scope_campaign_id]
                )
                suite_ids = [
                    link.to_artifact_id
                    for link in outgoing
                    if link.link_type == "campaign_includes_suite"
                ]
                if not suite_ids:
                    candidates = []
                else:
                    allowed = set(
                        await self._link_repo.list_run_ids_for_suite_targets(query.project_id, suite_ids)
                    )
                    candidates = [(r, t) for r, t in candidates if r in allowed]
            run_ids = list({r for r, _ in candidates})
        if not run_ids:
            return [
                LastTestExecutionStatusDTO(
                    test_id=tid,
                    status=None,
                    run_id=None,
                    run_title=None,
                    run_updated_at=None,
                    param_row_index=None,
                    step_results=[],
                )
                for tid in ordered_unique
            ]

        runs = await self._artifact_repo.list_by_ids_in_project(query.project_id, run_ids)
        run_by_id: dict[uuid.UUID, Artifact] = {r.id: r for r in runs}
        runs_sorted = sorted(
            runs,
            key=lambda r: (r.updated_at.timestamp() if r.updated_at else 0.0, str(r.id)),
            reverse=True,
        )

        outgoing_all = await self._link_repo.list_outgoing_links_from_artifacts(query.project_id, run_ids)
        outgoing_by_run = _group_outgoing_by_from(outgoing_all)

        suite_ids: set[uuid.UUID] = set()
        for rid in run_ids:
            for link in outgoing_by_run.get(rid, []):
                if link.link_type == "run_for_suite":
                    suite_ids.add(link.to_artifact_id)
                    break

        suite_links = await self._link_repo.list_suite_includes_tests_for_suites(
            query.project_id, list(suite_ids)
        )
        suite_out_by_suite = _group_suite_includes_by_suite(suite_links)

        linked_by_run: dict[uuid.UUID, set[uuid.UUID]] = {}
        for run in runs_sorted:
            rid = run.id
            outgoing = outgoing_by_run.get(rid, [])
            linked_by_run[rid] = linked_execution_test_ids_for_run(outgoing, suite_out_by_suite)

        results: dict[uuid.UUID, LastTestExecutionStatusDTO] = {}
        for tid in ordered_unique:
            results[tid] = LastTestExecutionStatusDTO(
                test_id=tid,
                status=None,
                run_id=None,
                run_title=None,
                run_updated_at=None,
                param_row_index=None,
                step_results=[],
            )

        for run in runs_sorted:
            rid = run.id
            art = run_by_id.get(rid)
            if art is None:
                continue
            linked = linked_by_run.get(rid, set())
            cf = art.custom_fields or {}
            for tid in ordered_unique:
                if tid in results and results[tid].status is not None:
                    continue
                if tid not in linked:
                    continue
                row = metrics_row_for_test_id(cf, tid)
                if row is None:
                    continue
                st = normalize_execution_status(row.get("status")) or "not-executed"
                pri = row.get("paramRowIndex")
                pidx: int | None = pri if isinstance(pri, int) else None
                steps = [
                    LastExecutionStepStatusDTO(step_id=sid, status=sst)
                    for sid, sst in step_statuses_from_metrics_row(row)
                ]
                results[tid] = LastTestExecutionStatusDTO(
                    test_id=tid,
                    status=st,
                    run_id=rid,
                    run_title=art.title,
                    run_updated_at=art.updated_at,
                    param_row_index=pidx,
                    step_results=steps,
                )

        return [results[tid] for tid in ordered_unique]
