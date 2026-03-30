import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from alm.artifact.domain.entities import Artifact
from alm.artifact_link.domain.entities import ArtifactLink
from alm.quality.application.queries.batch_last_test_execution_status import (
    BatchLastTestExecutionStatus,
    BatchLastTestExecutionStatusHandler,
    MAX_TEST_IDS,
)
from alm.shared.domain.exceptions import ValidationError


@pytest.mark.asyncio
async def test_handler_empty_test_ids():
    h = BatchLastTestExecutionStatusHandler(
        project_repo=AsyncMock(),
        artifact_repo=AsyncMock(),
        link_repo=AsyncMock(),
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(
            tenant_id=uuid.uuid4(),
            project_id=uuid.uuid4(),
            test_ids=[],
        )
    )
    assert out == []


@pytest.mark.asyncio
async def test_handler_too_many_ids():
    h = BatchLastTestExecutionStatusHandler(
        project_repo=AsyncMock(),
        artifact_repo=AsyncMock(),
        link_repo=AsyncMock(),
    )
    tid = uuid.uuid4()
    ids = [uuid.uuid4() for _ in range(MAX_TEST_IDS + 1)]
    with pytest.raises(ValidationError):
        await h.handle(
            BatchLastTestExecutionStatus(
                tenant_id=uuid.uuid4(),
                project_id=uuid.uuid4(),
                test_ids=ids,
            )
        )


@pytest.mark.asyncio
async def test_handler_no_candidates_returns_nulls():
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    test_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    link_repo = AsyncMock()
    link_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=AsyncMock(),
        link_repo=link_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(tenant_id=tenant, project_id=proj, test_ids=[test_id])
    )
    assert len(out) == 1
    assert out[0].test_id == test_id
    assert out[0].status is None
    assert out[0].run_id is None


@pytest.mark.asyncio
async def test_handler_returns_status_and_step_results_from_run_metrics():
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    test_id = uuid.uuid4()
    run_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    metrics = {
        "v": 1,
        "results": [
            {
                "testId": str(test_id),
                "status": "passed",
                "stepResults": [
                    {"stepId": "s1", "status": "failed"},
                    {"stepId": "s2", "status": "passed"},
                ],
            }
        ],
    }

    run_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Run A",
        state="in_progress",
        id=run_id,
        custom_fields={"run_metrics_json": json.dumps(metrics)},
        updated_at=datetime(2025, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
    )

    link_direct = ArtifactLink.create(
        project_id=proj,
        from_artifact_id=run_id,
        to_artifact_id=test_id,
        link_type="includes_test",
    )

    link_repo = AsyncMock()
    link_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[(run_id, test_id)])
    link_repo.list_outgoing_links_from_artifacts = AsyncMock(return_value=[link_direct])
    link_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[run_art])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=link_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(tenant_id=tenant, project_id=proj, test_ids=[test_id])
    )
    assert len(out) == 1
    dto = out[0]
    assert dto.test_id == test_id
    assert dto.status == "passed"
    assert dto.run_id == run_id
    assert dto.run_title == "Run A"
    assert dto.param_row_index is None
    assert len(dto.step_results) == 2
    assert dto.step_results[0].step_id == "s1"
    assert dto.step_results[0].status == "failed"
    assert dto.step_results[1].step_id == "s2"
    assert dto.step_results[1].status == "passed"
