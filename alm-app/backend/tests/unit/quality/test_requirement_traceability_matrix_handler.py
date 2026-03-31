"""Unit tests for RequirementTraceabilityMatrixHandler (mocked repos)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.artifact.domain.entities import Artifact
from alm.artifact_link.domain.entities import ArtifactLink
from alm.quality.application.queries import requirement_traceability_matrix as rtm_mod
from alm.quality.application.queries.requirement_traceability_matrix import (
    RequirementTraceabilityMatrix,
    RequirementTraceabilityMatrixHandler,
)
from alm.shared.domain.exceptions import ValidationError


@pytest.fixture(autouse=True)
def _clear_matrix_cache() -> None:
    rtm_mod._matrix_cache.clear()
    yield
    rtm_mod._matrix_cache.clear()


@pytest.mark.asyncio
async def test_single_requirement_and_test_builds_matrix() -> None:
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
    test_art = Artifact.create(
        project_id=proj,
        artifact_type="test-case",
        title="Login test",
        state="ready",
        id=test_id,
        artifact_key="TC-1",
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
    artifact_repo.find_by_id = AsyncMock(return_value=req)

    async def _list_by_ids(_project_id: uuid.UUID, ids: list[uuid.UUID]) -> list[Artifact]:
        out: list[Artifact] = []
        if test_id in ids:
            out.append(test_art)
        if run_id in ids:
            out.append(run_art)
        return out

    artifact_repo.list_by_ids_in_project = AsyncMock(side_effect=_list_by_ids)

    link_repo = AsyncMock()
    link_repo.list_links_to_artifacts = AsyncMock(return_value=[vlink])
    link_repo.list_outgoing_links_from_artifacts = AsyncMock(
        side_effect=lambda _p, ids: [run_link] if run_id in ids else []
    )
    link_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[(run_id, test_id)])
    link_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    h = RequirementTraceabilityMatrixHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=link_repo,
        process_template_repo=AsyncMock(),
    )
    out = await h.handle(
        RequirementTraceabilityMatrix(
            tenant_id=tenant,
            project_id=proj,
            include_reverse_verifies=False,
            refresh=True,
        )
    )

    assert out.cache_hit is False
    assert len(out.rows) == 1
    assert out.rows[0].requirement_id == req_id
    assert out.rows[0].artifact_key == "REQ-1"
    assert len(out.rows[0].cells) == 1
    assert out.rows[0].cells[0].test_id == test_id
    assert out.rows[0].cells[0].status == "passed"
    assert len(out.columns) == 1
    assert out.columns[0].artifact_key == "TC-1"
    assert out.columns[0].title == "Login test"
    assert len(out.relationships) == 1
    assert out.relationships[0].link_type == "verifies"


@pytest.mark.asyncio
async def test_search_filters_rows_and_columns() -> None:
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    root_id = uuid.uuid4()
    req_login = uuid.uuid4()
    req_checkout = uuid.uuid4()
    test_login = uuid.uuid4()
    test_checkout = uuid.uuid4()

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
    login_req = Artifact.create(
        project_id=proj,
        artifact_type="requirement",
        title="Login",
        state="new",
        id=req_login,
        parent_id=root_id,
        artifact_key="REQ-1",
    )
    checkout_req = Artifact.create(
        project_id=proj,
        artifact_type="requirement",
        title="Checkout",
        state="new",
        id=req_checkout,
        parent_id=root_id,
        artifact_key="REQ-2",
    )
    login_test = Artifact.create(
        project_id=proj,
        artifact_type="test-case",
        title="Login test",
        state="ready",
        id=test_login,
        artifact_key="TC-1",
    )
    checkout_test = Artifact.create(
        project_id=proj,
        artifact_type="test-case",
        title="Checkout test",
        state="ready",
        id=test_checkout,
        artifact_key="TC-2",
    )

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    async def _list_bp(*_a: object, **kw: object) -> list[Artifact]:
        if kw.get("type_filter") == "root-requirement":
            return [root]
        return [login_req, checkout_req]

    artifact_repo = AsyncMock()
    artifact_repo.list_by_project = AsyncMock(side_effect=_list_bp)
    artifact_repo.count_by_project = AsyncMock(return_value=2)
    artifact_repo.find_by_id = AsyncMock(return_value=login_req)
    artifact_repo.list_by_ids_in_project = AsyncMock(
        return_value=[login_test, checkout_test]
    )

    link_repo = AsyncMock()
    link_repo.list_links_to_artifacts = AsyncMock(
        return_value=[
            ArtifactLink.create(
                project_id=proj,
                from_artifact_id=test_login,
                to_artifact_id=req_login,
                link_type="verifies",
            ),
            ArtifactLink.create(
                project_id=proj,
                from_artifact_id=test_checkout,
                to_artifact_id=req_checkout,
                link_type="verifies",
            ),
        ]
    )
    link_repo.list_outgoing_links_from_artifacts = AsyncMock(return_value=[])
    link_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[])
    link_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    h = RequirementTraceabilityMatrixHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=link_repo,
        process_template_repo=AsyncMock(),
    )
    out = await h.handle(
        RequirementTraceabilityMatrix(
            tenant_id=tenant,
            project_id=proj,
            include_reverse_verifies=False,
            search="login",
            refresh=True,
        )
    )

    assert [row.title for row in out.rows] == ["Login"]
    assert [col.title for col in out.columns] == ["Login test"]


@pytest.mark.asyncio
async def test_rejects_multiple_execution_scopes() -> None:
    h = RequirementTraceabilityMatrixHandler(
        project_repo=AsyncMock(),
        artifact_repo=AsyncMock(),
        link_repo=AsyncMock(),
        process_template_repo=AsyncMock(),
    )
    with pytest.raises(ValidationError, match="At most one"):
        await h.handle(
            RequirementTraceabilityMatrix(
                tenant_id=uuid.uuid4(),
                project_id=uuid.uuid4(),
                scope_run_id=uuid.uuid4(),
                scope_suite_id=uuid.uuid4(),
            )
        )
