from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from alm.project.application.queries.get_velocity import GetVelocity, GetVelocityHandler
from alm.project.domain.entities import Project


def _project(tenant_id: uuid.UUID, project_id: uuid.UUID, version_id: uuid.UUID | None = None) -> Project:
    return Project(
        tenant_id=tenant_id,
        id=project_id,
        name="P",
        slug="p",
        code="P",
        process_template_version_id=version_id,
    )


@pytest.mark.asyncio
async def test_velocity_uses_manifest_done_states_when_default_query_done_states() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    cycle_id = uuid.uuid4()
    version_id = uuid.uuid4()

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=_project(tenant_id, project_id, version_id))
    cycle_repo = AsyncMock()
    cycle_repo.list_by_project = AsyncMock(return_value=[SimpleNamespace(id=cycle_id, name="Sprint 1", path="R1/S1")])
    artifact_repo = AsyncMock()
    artifact_repo.sum_effort_by_cycles = AsyncMock(return_value=[(cycle_id, 5.0)])
    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id = AsyncMock(
        return_value=SimpleNamespace(manifest_bundle={"burndown_done_states": ["finished"]})
    )

    handler = GetVelocityHandler(
        project_repo=project_repo,
        cycle_repo=cycle_repo,
        artifact_repo=artifact_repo,
        process_template_repo=process_template_repo,
    )
    result = await handler.handle(
        GetVelocity(
            tenant_id=tenant_id,
            project_id=project_id,
            cycle_ids=[cycle_id],
        )
    )

    assert len(result) == 1
    assert result[0].cycle_id == cycle_id
    assert result[0].total_effort == 5.0
    artifact_repo.sum_effort_by_cycles.assert_awaited_once_with(project_id, [cycle_id], ("finished",), "story_points")


@pytest.mark.asyncio
async def test_velocity_preserves_explicit_done_states_override() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    cycle_id = uuid.uuid4()

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=_project(tenant_id, project_id))
    cycle_repo = AsyncMock()
    cycle_repo.list_by_project = AsyncMock(return_value=[SimpleNamespace(id=cycle_id, name="Sprint 1", path="R1/S1")])
    artifact_repo = AsyncMock()
    artifact_repo.sum_effort_by_cycles = AsyncMock(return_value=[(cycle_id, 3.0)])
    process_template_repo = AsyncMock()
    process_template_repo.find_version_by_id = AsyncMock()

    handler = GetVelocityHandler(
        project_repo=project_repo,
        cycle_repo=cycle_repo,
        artifact_repo=artifact_repo,
        process_template_repo=process_template_repo,
    )
    await handler.handle(
        GetVelocity(
            tenant_id=tenant_id,
            project_id=project_id,
            cycle_ids=[cycle_id],
            done_states=("done_custom",),
        )
    )

    artifact_repo.sum_effort_by_cycles.assert_awaited_once_with(
        project_id,
        [cycle_id],
        ("done_custom",),
        "story_points",
    )

