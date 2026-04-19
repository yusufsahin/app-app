import json
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from alm.artifact.domain.entities import Artifact
from alm.quality.application.queries.batch_last_test_execution_status import (
    MAX_TEST_IDS,
    BatchLastTestExecutionStatus,
    BatchLastTestExecutionStatusHandler,
)
from alm.relationship.domain.entities import Relationship
from alm.shared.domain.exceptions import ValidationError


@pytest.mark.asyncio
async def test_handler_empty_test_ids():
    h = BatchLastTestExecutionStatusHandler(
        project_repo=AsyncMock(),
        artifact_repo=AsyncMock(),
        relationship_repo=AsyncMock(),
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
        relationship_repo=AsyncMock(),
    )
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

    relationship_repo = AsyncMock()
    relationship_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=AsyncMock(),
        relationship_repo=relationship_repo,
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
        updated_at=datetime(2025, 1, 2, 12, 0, 0, tzinfo=UTC),
    )

    link_direct = Relationship.create(
        project_id=proj,
        source_artifact_id=run_id,
        target_artifact_id=test_id,
        relationship_type="includes_test",
    )

    relationship_repo = AsyncMock()
    relationship_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[(run_id, test_id)])
    relationship_repo.list_outgoing_relationships_from_artifacts = AsyncMock(return_value=[link_direct])
    relationship_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[run_art])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        relationship_repo=relationship_repo,
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
        updated_at=datetime(2025, 1, 1, tzinfo=UTC),
    )

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[wrong])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        relationship_repo=AsyncMock(),
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
        updated_at=datetime(2025, 1, 3, tzinfo=UTC),
    )

    link_direct = Relationship.create(
        project_id=proj,
        source_artifact_id=run_id,
        target_artifact_id=test_id,
        relationship_type="includes_test",
    )

    relationship_repo = AsyncMock()
    relationship_repo.list_candidate_run_test_pairs = AsyncMock()
    relationship_repo.list_outgoing_relationships_from_artifacts = AsyncMock(return_value=[link_direct])
    relationship_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(side_effect=[[run_art], [run_art]])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        relationship_repo=relationship_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(
            tenant_id=tenant,
            project_id=proj,
            test_ids=[test_id],
            scope_run_id=run_id,
        )
    )
    relationship_repo.list_candidate_run_test_pairs.assert_not_called()
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
        updated_at=datetime(2025, 1, 5, tzinfo=UTC),
    )
    dropped_metrics = {"v": 1, "results": [{"testId": str(test_id), "status": "failed"}]}
    dropped_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Dropped",
        state="completed",
        id=run_dropped,
        custom_fields={"run_metrics_json": json.dumps(dropped_metrics)},
        updated_at=datetime(2025, 1, 10, tzinfo=UTC),
    )

    link_kept = Relationship.create(
        project_id=proj,
        source_artifact_id=run_kept,
        target_artifact_id=test_id,
        relationship_type="includes_test",
    )
    Relationship.create(
        project_id=proj,
        source_artifact_id=run_dropped,
        target_artifact_id=test_id,
        relationship_type="includes_test",
    )

    relationship_repo = AsyncMock()
    relationship_repo.list_candidate_run_test_pairs = AsyncMock(
        return_value=[(run_dropped, test_id), (run_kept, test_id)]
    )
    relationship_repo.list_run_ids_for_suite_targets = AsyncMock(return_value=[run_kept])
    relationship_repo.list_outgoing_relationships_from_artifacts = AsyncMock(return_value=[link_kept])
    relationship_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[kept_art, dropped_art])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        relationship_repo=relationship_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(
            tenant_id=tenant,
            project_id=proj,
            test_ids=[test_id],
            scope_suite_id=suite_id,
        )
    )
    relationship_repo.list_run_ids_for_suite_targets.assert_awaited_once_with(proj, [suite_id])
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

    relationship_repo = AsyncMock()
    relationship_repo.list_candidate_run_test_pairs = AsyncMock(
        return_value=[(uuid.uuid4(), test_id)]
    )
    relationship_repo.list_outgoing_relationships_from_artifacts = AsyncMock(return_value=[])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=AsyncMock(),
        relationship_repo=relationship_repo,
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
    relationship_repo.list_run_ids_for_suite_targets.assert_not_called()


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

    campaign_link = Relationship.create(
        project_id=proj,
        source_artifact_id=campaign_id,
        target_artifact_id=suite_id,
        relationship_type="campaign_includes_suite",
    )

    metrics = {"v": 1, "results": [{"testId": str(test_id), "status": "passed"}]}
    run_art = Artifact(
        project_id=proj,
        artifact_type="test-run",
        title="Campaign run",
        state="completed",
        id=run_id,
        custom_fields={"run_metrics_json": json.dumps(metrics)},
        updated_at=datetime(2025, 1, 4, tzinfo=UTC),
    )

    link_run = Relationship.create(
        project_id=proj,
        source_artifact_id=run_id,
        target_artifact_id=test_id,
        relationship_type="includes_test",
    )

    relationship_repo = AsyncMock()
    relationship_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[(run_id, test_id)])
    relationship_repo.list_outgoing_relationships_from_artifacts = AsyncMock(
        side_effect=[
            [campaign_link],
            [link_run],
        ]
    )
    relationship_repo.list_run_ids_for_suite_targets = AsyncMock(return_value=[run_id])
    relationship_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[run_art])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        relationship_repo=relationship_repo,
    )
    out = await h.handle(
        BatchLastTestExecutionStatus(
            tenant_id=tenant,
            project_id=proj,
            test_ids=[test_id],
            scope_campaign_id=campaign_id,
        )
    )
    relationship_repo.list_run_ids_for_suite_targets.assert_awaited_once_with(proj, [suite_id])
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
        updated_at=datetime(2025, 1, 2, 12, 0, 0, tzinfo=UTC),
    )

    link_direct = Relationship.create(
        project_id=proj,
        source_artifact_id=run_id,
        target_artifact_id=test_id,
        relationship_type="includes_test",
    )

    relationship_repo = AsyncMock()
    relationship_repo.list_candidate_run_test_pairs = AsyncMock(return_value=[(run_id, test_id)])
    relationship_repo.list_outgoing_relationships_from_artifacts = AsyncMock(return_value=[link_direct])
    relationship_repo.list_suite_includes_tests_for_suites = AsyncMock(return_value=[])

    artifact_repo = AsyncMock()
    artifact_repo.list_by_ids_in_project = AsyncMock(return_value=[run_art])

    h = BatchLastTestExecutionStatusHandler(
        project_repo=project_repo,
        artifact_repo=artifact_repo,
        relationship_repo=relationship_repo,
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
