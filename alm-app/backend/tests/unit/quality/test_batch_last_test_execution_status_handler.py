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


@pytest.mark.asyncio
async def test_scope_run_id_wrong_artifact_raises():
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    test_id = uuid.uuid4()
    scope_run = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    wrong = Artifact(
        project_id=proj,
        artifact_type="test-case",
        title="Not a run",
        state="active",
        id=scope_run,
        custom_fields={},
        updated_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[wrong])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=AsyncMock(),
    )
    with pytest.raises(ValidationError, match="scope_run_id"):
        await h.handle(
            BatchLastTestExecutionStatus(
                tenant_id=tenant,
                project_id=proj,
                test_ids=[test_id],
                scope_run_id=scope_run,
            )
        )


@pytest.mark.asyncio
async def test_scope_run_id_skips_candidate_query_uses_only_that_run():
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    test_id = uuid.uuid4()
    run_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    metrics = {"v": 1, "results": [{"testId": str(test_id), "status": "passed"}]}
    run_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Scoped run",
        state="completed",
        id=run_id,
        custom_fields={"run_metrics_json": json.dumps(metrics)},
        updated_at=datetime(2025, 1, 3, tzinfo=timezone.utc),
    )

    link_direct = ArtifactLink.create(
        project_id=proj,
        from_artifact_id=run_id,
        to_artifact_id=test_id,
        link_type="includes_test",
    )

    link_repo = AsyncMock()
    link_repo.list_candidate_run_test_pairs = AsyncMock()
    link_repo.list_outgoing_links_from_artifacts = AsyncMock(return_value=[link_direct])
    link_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(side_effect=[[run_art], [run_art]])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=link_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(
            tenant_id=tenant,
            project_id=proj,
            test_ids=[test_id],
            scope_run_id=run_id,
        )
    )
    link_repo.list_candidate_run_test_pairs.assert_not_called()
    assert len(out) == 1
    assert out[0].status == "passed"
    assert out[0].run_id == run_id


@pytest.mark.asyncio
async def test_scope_suite_id_filters_candidates():
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    test_id = uuid.uuid4()
    run_kept = uuid.uuid4()
    run_dropped = uuid.uuid4()
    suite_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    metrics = {"v": 1, "results": [{"testId": str(test_id), "status": "passed"}]}
    kept_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Kept",
        state="completed",
        id=run_kept,
        custom_fields={"run_metrics_json": json.dumps(metrics)},
        updated_at=datetime(2025, 1, 5, tzinfo=timezone.utc),
    )
    dropped_metrics = {"v": 1, "results": [{"testId": str(test_id), "status": "failed"}]}
    dropped_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Dropped",
        state="completed",
        id=run_dropped,
        custom_fields={"run_metrics_json": json.dumps(dropped_metrics)},
        updated_at=datetime(2025, 1, 10, tzinfo=timezone.utc),
    )

    link_kept = ArtifactLink.create(
        project_id=proj,
        from_artifact_id=run_kept,
        to_artifact_id=test_id,
        link_type="includes_test",
    )
    link_dropped = ArtifactLink.create(
        project_id=proj,
        from_artifact_id=run_dropped,
        to_artifact_id=test_id,
        link_type="includes_test",
    )

    link_repo = AsyncMock()
    link_repo.list_candidate_run_test_pairs = AsyncMock(
        return_value=[(run_dropped, test_id), (run_kept, test_id)]
    )
    link_repo.list_run_ids_for_suite_targets = AsyncMock(return_value=[run_kept])
    link_repo.list_outgoing_links_from_artifacts = AsyncMock(return_value=[link_kept])
    link_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[kept_art, dropped_art])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=link_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(
            tenant_id=tenant,
            project_id=proj,
            test_ids=[test_id],
            scope_suite_id=suite_id,
        )
    )
    link_repo.list_run_ids_for_suite_targets.assert_awaited_once_with(proj, [suite_id])
    assert len(out) == 1
    assert out[0].run_id == run_kept
    assert out[0].status == "passed"


@pytest.mark.asyncio
async def test_scope_campaign_id_no_suites_yields_nulls():
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    test_id = uuid.uuid4()
    campaign_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    link_repo = AsyncMock()
    link_repo.list_candidate_run_test_pairs = AsyncMock(
        return_value=[(uuid.uuid4(), test_id)]
    )
    link_repo.list_outgoing_links_from_artifacts = AsyncMock(return_value=[])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=AsyncMock(),
        link_repo=link_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(
            tenant_id=tenant,
            project_id=proj,
            test_ids=[test_id],
            scope_campaign_id=campaign_id,
        )
    )
    assert len(out) == 1
    assert out[0].status is None
    link_repo.list_run_ids_for_suite_targets.assert_not_called()


@pytest.mark.asyncio
async def test_scope_campaign_id_filters_via_campaign_suites():
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    test_id = uuid.uuid4()
    campaign_id = uuid.uuid4()
    suite_id = uuid.uuid4()
    run_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    campaign_link = ArtifactLink.create(
        project_id=proj,
        from_artifact_id=campaign_id,
        to_artifact_id=suite_id,
        link_type="campaign_includes_suite",
    )

    metrics = {"v": 1, "results": [{"testId": str(test_id), "status": "passed"}]}
    run_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Campaign run",
        state="completed",
        id=run_id,
        custom_fields={"run_metrics_json": json.dumps(metrics)},
        updated_at=datetime(2025, 1, 4, tzinfo=timezone.utc),
    )

    link_run = ArtifactLink.create(
        project_id=proj,
        from_artifact_id=run_id,
        to_artifact_id=test_id,
        link_type="includes_test",
    )

    link_repo = AsyncMock()
    link_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[(run_id, test_id)])
    link_repo.list_outgoing_links_from_artifacts = AsyncMock(
        side_effect=[
            [campaign_link],
            [link_run],
        ]
    )
    link_repo.list_run_ids_for_suite_targets = AsyncMock(return_value=[run_id])
    link_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[run_art])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        link_repo=link_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(
            tenant_id=tenant,
            project_id=proj,
            test_ids=[test_id],
            scope_campaign_id=campaign_id,
        )
    )
    link_repo.list_run_ids_for_suite_targets.assert_awaited_once_with(proj, [suite_id])
    assert len(out) == 1
    assert out[0].run_id == run_id
    assert out[0].status == "passed"


@pytest.mark.asyncio
async def test_scope_configuration_id_filters_matching_metrics_row():
    tenant = uuid.uuid4()
    proj = uuid.uuid4()
    test_id = uuid.uuid4()
    run_id = uuid.uuid4()

    project = MagicMock()
    project.tenant_id = tenant

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=project)

    metrics = {
        "v": 2,
        "results": [
            {"testId": str(test_id), "status": "failed", "configurationId": "cfg-a", "stepResults": []},
            {"testId": str(test_id), "status": "passed", "configurationId": "cfg-b", "stepResults": []},
        ],
    }

    run_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Run A",
        state="completed",
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
        BatchLastTestExecutionStatus(
            tenant_id=tenant,
            project_id=proj,
            test_ids=[test_id],
            scope_configuration_id="cfg-b",
        )
    )
    assert len(out) == 1
    assert out[0].status == "passed"
    assert out[0].configuration_id == "cfg-b"
