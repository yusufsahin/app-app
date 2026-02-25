"""Unit tests for org dashboard query handlers (stats and activity)."""

from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from alm.project.application.queries.get_org_dashboard_activity import (
    GetOrgDashboardActivity,
    GetOrgDashboardActivityHandler,
)
from alm.project.application.queries.get_org_dashboard_stats import (
    GetOrgDashboardStats,
    GetOrgDashboardStatsHandler,
)
from alm.project.domain.entities import Project


def _project(pid: uuid.UUID, slug: str) -> Project:
    return Project(
        tenant_id=uuid.uuid4(),
        name="P",
        slug=slug,
        code="P",
        id=pid,
    )


@pytest.mark.asyncio
class TestGetOrgDashboardStatsHandler:
    async def test_returns_counts_from_repos(self) -> None:
        tenant_id = uuid.uuid4()
        proj_id = uuid.uuid4()
        projects = [_project(proj_id, "my-proj")]

        project_repo = AsyncMock()
        project_repo.list_by_tenant = AsyncMock(return_value=projects)

        artifact_repo = AsyncMock()
        artifact_repo.count_by_project_ids = AsyncMock(return_value=5)
        artifact_repo.count_open_defects_by_project_ids = AsyncMock(return_value=1)

        task_repo = AsyncMock()
        task_repo.count_by_project_ids = AsyncMock(return_value=10)

        handler = GetOrgDashboardStatsHandler(
            project_repo=project_repo,
            artifact_repo=artifact_repo,
            task_repo=task_repo,
        )
        result = await handler.handle(GetOrgDashboardStats(tenant_id=tenant_id))

        assert result.projects == 1
        assert result.artifacts == 5
        assert result.tasks == 10
        assert result.open_defects == 1
        project_repo.list_by_tenant.assert_awaited_once_with(tenant_id)
        artifact_repo.count_by_project_ids.assert_awaited_once_with([proj_id])
        task_repo.count_by_project_ids.assert_awaited_once_with([proj_id])

    async def test_empty_projects_returns_zeros(self) -> None:
        project_repo = AsyncMock()
        project_repo.list_by_tenant = AsyncMock(return_value=[])

        artifact_repo = AsyncMock()
        artifact_repo.count_by_project_ids = AsyncMock(return_value=0)
        artifact_repo.count_open_defects_by_project_ids = AsyncMock(return_value=0)

        task_repo = AsyncMock()
        task_repo.count_by_project_ids = AsyncMock(return_value=0)

        handler = GetOrgDashboardStatsHandler(
            project_repo=project_repo,
            artifact_repo=artifact_repo,
            task_repo=task_repo,
        )
        result = await handler.handle(GetOrgDashboardStats(tenant_id=uuid.uuid4()))

        assert result.projects == 0
        assert result.artifacts == 0
        assert result.tasks == 0
        assert result.open_defects == 0
        artifact_repo.count_by_project_ids.assert_awaited_once_with([])


@pytest.mark.asyncio
class TestGetOrgDashboardActivityHandler:
    async def test_returns_activity_items_with_slugs(self) -> None:
        tenant_id = uuid.uuid4()
        proj_id = uuid.uuid4()
        artifact_id = uuid.uuid4()
        projects = [_project(proj_id, "my-proj")]
        rows = [
            (artifact_id, proj_id, "Title", "active", "requirement", datetime.now()),
        ]

        project_repo = AsyncMock()
        project_repo.list_by_tenant = AsyncMock(return_value=projects)

        artifact_repo = AsyncMock()
        artifact_repo.list_recent_by_project_ids = AsyncMock(return_value=rows)

        handler = GetOrgDashboardActivityHandler(
            project_repo=project_repo,
            artifact_repo=artifact_repo,
        )
        result = await handler.handle(
            GetOrgDashboardActivity(tenant_id=tenant_id, limit=10),
        )

        assert len(result) == 1
        assert result[0].artifact_id == artifact_id
        assert result[0].project_id == proj_id
        assert result[0].project_slug == "my-proj"
        assert result[0].title == "Title"
        assert result[0].state == "active"
        assert result[0].artifact_type == "requirement"
        project_repo.list_by_tenant.assert_awaited_once_with(tenant_id)
        artifact_repo.list_recent_by_project_ids.assert_awaited_once_with(
            [proj_id], limit=10
        )

    async def test_empty_projects_returns_empty_list(self) -> None:
        project_repo = AsyncMock()
        project_repo.list_by_tenant = AsyncMock(return_value=[])

        artifact_repo = AsyncMock()
        artifact_repo.list_recent_by_project_ids = AsyncMock(return_value=[])

        handler = GetOrgDashboardActivityHandler(
            project_repo=project_repo,
            artifact_repo=artifact_repo,
        )
        result = await handler.handle(
            GetOrgDashboardActivity(tenant_id=uuid.uuid4(), limit=20),
        )

        assert result == []
        artifact_repo.list_recent_by_project_ids.assert_awaited_once_with([], limit=20)
