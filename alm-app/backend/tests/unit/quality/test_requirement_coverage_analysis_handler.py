"""Unit tests for RequirementCoverageAnalysisHandler (mocked repos)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.artifact.domain.entities import Artifact
from alm.artifact_link.domain.entities import ArtifactLink
from alm.quality.application.queries import requirement_coverage_analysis as rca_mod
from alm.quality.application.queries.requirement_coverage_analysis import (
    MAX_COVERAGE_ARTIFACTS_WITHOUT_UNDER,
    RequirementCoverageAnalysis,
    RequirementCoverageAnalysisHandler,
)
from alm.shared.domain.exceptions import ValidationError


@pytest.fixture(autouse=True)
def _clear_coverage_cache() -> None:
    rca_mod._coverage_cache.clear()
    yield
    rca_mod._coverage_cache.clear()


@pytest.mark.asyncio
async def test_rejects_multiple_execution_scopes() -> None:
    h = RequirementCoverageAnalysisHandler(
        project_repo=AsyncMock(),
        artifact_repo=AsyncMock(),
        link_repo=AsyncMock(),
        process_template_repo=AsyncMock(),
    )
    with pytest.raises(ValidationError, match="At most one"):
        await h.handle(
            RequirementCoverageAnalysis(
                tenant_id=uuid.uuid4(),
                project_id=uuid.uuid4(),
                scope_run_id=uuid.uuid4(),
                scope_suite_id=uuid.uuid4(),
            )
        )


@pytest.mark.asyncio
async def test_project_not_found() -> None:
    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=None)
    h = RequirementCoverageAnalysisHandler(
        project_repo=project_repo,
        artifact_repo=AsyncMock(),
        link_repo=AsyncMock(),
        process_template_repo=AsyncMock(),
    )
    with pytest.raises(ValidationError, match="Project not found"):
        await h.handle(
            RequirementCoverageAnalysis(
                tenant_id=uuid.uuid4(),
                project_id=uuid.uuid4(),
            )
        )


@pytest.mark.asyncio
async def test_tree_too_large_without_under_raises() -> None:
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    root_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant
    project.process_template_version_id = None

    root = Artifact.create(
        project_id=proj,
        artifact_type="root-requirement",
        title="Root",
        state="active",
        id=root_id,
    )

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    artifact_repo = AsyncMock()

    async def _list_bp(*_a: object, **kw: object) -> list[Artifact]:
        if kw.get("type_filter") == "root-requirement":
            return [root]
        return []

    artifact_repo.list_by_project = AsyncMock(side_effect=_list_bp)
    artifact_repo.count_by_project = AsyncMock(return_value=MAX_COVERAGE_ARTIFACTS_WITHOUT_UNDER + 1)

    h = RequirementCoverageAnalysisHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=AsyncMock(),
        process_template_repo=AsyncMock(),
    )
    with pytest.raises(ValidationError, match="too large"):
        await h.handle(RequirementCoverageAnalysis(tenant_id=tenant, project_id=proj))


@pytest.mark.asyncio
async def test_under_not_in_project_raises() -> None:
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    root_id = uuid.uuid4()
    under_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant
    project.process_template_version_id = None

    root = Artifact.create(
        project_id=proj,
        artifact_type="root-requirement",
        title="Root",
        state="active",
        id=root_id,
    )

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    artifact_repo = AsyncMock()

    async def _list_bp(*_a: object, **kw: object) -> list[Artifact]:
        if kw.get("type_filter") == "root-requirement":
            return [root]
        return []

    artifact_repo.list_by_project = AsyncMock(side_effect=_list_bp)
    artifact_repo.count_by_project = AsyncMock(return_value=1)
    artifact_repo.find_by_id = AsyncMock(return_value=None)

    h = RequirementCoverageAnalysisHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=AsyncMock(),
        process_template_repo=AsyncMock(),
    )
    with pytest.raises(ValidationError, match="under_artifact_id"):
        await h.handle(
            RequirementCoverageAnalysis(
                tenant_id=tenant,
                project_id=proj,
                under_artifact_id=under_id,
            )
        )


@pytest.mark.asyncio
async def test_no_roots_returns_empty_nodes() -> None:
    tenant = uuid.uuid4()
    proj = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant
    project.process_template_version_id = None

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    artifact_repo = AsyncMock()
    artifact_repo.list_by_project = AsyncMock(return_value=[])
    artifact_repo.count_by_project = AsyncMock(return_value=0)

    h = RequirementCoverageAnalysisHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=AsyncMock(),
        process_template_repo=AsyncMock(),
    )
    out = await h.handle(RequirementCoverageAnalysis(tenant_id=tenant, project_id=proj))
    assert out.nodes == []
    assert out.leaves == []
    assert out.cache_hit is False


@pytest.mark.asyncio
async def test_single_requirement_with_verifies_and_passed_run() -> None:
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    root_id = uuid.uuid4()
    req_id = uuid.uuid4()
    test_id = uuid.uuid4()
    run_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant
    project.process_template_version_id = None

    root = Artifact.create(
        project_id=proj,
        artifact_type="root-requirement",
        title="Root",
        state="active",
        id=root_id,
    )
    req = Artifact.create(
        project_id=proj,
        artifact_type="requirement",
        title="Login",
        state="new",
        id=req_id,
        parent_id=root_id,
        artifact_key="REQ-1",
    )
    run_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Run 1",
        state="open",
        id=run_id,
        custom_fields={
            "run_metrics_json": json.dumps(
                {
                    "v": 1,
                    "results": [{"testId": str(test_id), "status": "passed", "stepResults": []}],
                }
            )
        },
        updated_at=datetime(2025, 3, 1, 10, 0, 0, tzinfo=timezone.utc),
    )

    vlink = ArtifactLink.create(
        project_id=proj,
        from_artifact_id=test_id,
        to_artifact_id=req_id,
        link_type="verifies",
    )
    run_link = ArtifactLink.create(
        project_id=proj,
        from_artifact_id=run_id,
        to_artifact_id=test_id,
        link_type="direct_run_test",
    )

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    async def _list_bp(*_a: object, **kw: object) -> list[Artifact]:
        if kw.get("type_filter") == "root-requirement":
            return [root]
        return [req]

    artifact_repo = AsyncMock()
    artifact_repo.list_by_project = AsyncMock(side_effect=_list_bp)
    artifact_repo.count_by_project = AsyncMock(return_value=1)

    async def _list_by_ids(p: uuid.UUID, ids: list[uuid.UUID]) -> list[Artifact]:
        if run_id in ids:
            return [run_art]
        return []

    artifact_repo.list_by_ids_in_project = AsyncMock(side_effect=_list_by_ids)

    link_repo = AsyncMock()
    link_repo.list_links_to_artifacts = AsyncMock(return_value=[vlink])
    link_repo.list_outgoing_links_from_artifacts = AsyncMock(
        side_effect=lambda _p, ids: [run_link] if run_id in ids else []
    )
    link_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[(run_id, test_id)])
    link_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    h = RequirementCoverageAnalysisHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=link_repo,
        process_template_repo=AsyncMock(),
    )
    out = await h.handle(
        RequirementCoverageAnalysis(
            tenant_id=tenant,
            project_id=proj,
            include_reverse_verifies=False,
            refresh=True,
        )
    )
    assert len(out.nodes) == 1
    assert out.nodes[0].id == req_id
    assert out.nodes[0].direct_status == "passed"
    assert out.nodes[0].subtree_counts.get("passed") == 1
    assert len(out.leaves) == 1
    assert out.leaves[0].leaf_status == "passed"
    assert out.leaves[0].verifying_test_ids == [test_id]


@pytest.mark.asyncio
async def test_cache_hit_on_second_identical_query() -> None:
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    root_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant
    project.process_template_version_id = None

    root = Artifact.create(
        project_id=proj,
        artifact_type="root-requirement",
        title="Root",
        state="active",
        id=root_id,
    )

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    artifact_repo = AsyncMock()

    async def _list_bp(*_a: object, **kw: object) -> list[Artifact]:
        if kw.get("type_filter") == "root-requirement":
            return [root]
        return []

    artifact_repo.list_by_project = AsyncMock(side_effect=_list_bp)
    artifact_repo.count_by_project = AsyncMock(return_value=0)

    h = RequirementCoverageAnalysisHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=AsyncMock(),
        process_template_repo=AsyncMock(),
    )
    q = RequirementCoverageAnalysis(tenant_id=tenant, project_id=proj)
    first = await h.handle(q)
    second = await h.handle(q)
    assert first.cache_hit is False
    assert second.cache_hit is True
    assert second.nodes == first.nodes
