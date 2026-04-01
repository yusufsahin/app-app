from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from alm.capacity.application.commands.create_capacity import CreateCapacity, CreateCapacityHandler
from alm.capacity.application.commands.update_capacity import UpdateCapacity, UpdateCapacityHandler
from alm.capacity.application.queries.list_capacity_by_project import (
    ListCapacityByProject,
    ListCapacityByProjectHandler,
)
from alm.capacity.domain.entities import Capacity
from alm.project.domain.entities import Project
from alm.shared.domain.exceptions import ValidationError


def _project(tenant_id: uuid.UUID, project_id: uuid.UUID) -> Project:
    return Project(tenant_id=tenant_id, id=project_id, name="P", slug="p", code="P")


@pytest.mark.asyncio
async def test_create_capacity_requires_team_or_user_owner() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=_project(tenant_id, project_id))
    capacity_repo = AsyncMock()

    handler = CreateCapacityHandler(capacity_repo=capacity_repo, project_repo=project_repo)

    with pytest.raises(ValidationError, match="Either team_id or user_id must be provided"):
        await handler.handle(
            CreateCapacity(
                tenant_id=tenant_id,
                project_id=project_id,
                capacity_value=8,
                team_id=None,
                user_id=None,
            )
        )


@pytest.mark.asyncio
async def test_create_capacity_persists_hybrid_owner() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    team_id = uuid.uuid4()

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=_project(tenant_id, project_id))
    capacity_repo = AsyncMock()
    capacity_repo.add = AsyncMock()

    handler = CreateCapacityHandler(capacity_repo=capacity_repo, project_repo=project_repo)
    dto = await handler.handle(
        CreateCapacity(
            tenant_id=tenant_id,
            project_id=project_id,
            team_id=team_id,
            capacity_value=16,
            unit="hours",
        )
    )

    assert dto.project_id == project_id
    assert dto.team_id == team_id
    assert dto.user_id is None
    assert dto.capacity_value == 16
    capacity_repo.add.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_capacity_rejects_negative_value() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    capacity_id = uuid.uuid4()
    team_id = uuid.uuid4()

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=_project(tenant_id, project_id))
    capacity_repo = AsyncMock()
    capacity_repo.find_by_id = AsyncMock(
        return_value=Capacity(
            id=capacity_id,
            project_id=project_id,
            team_id=team_id,
            capacity_value=8,
        )
    )

    handler = UpdateCapacityHandler(capacity_repo=capacity_repo, project_repo=project_repo)

    with pytest.raises(ValidationError, match="capacity_value must be >= 0"):
        await handler.handle(
            UpdateCapacity(
                tenant_id=tenant_id,
                project_id=project_id,
                capacity_id=capacity_id,
                capacity_value=-1,
            )
        )


@pytest.mark.asyncio
async def test_list_capacity_applies_optional_filters() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    cycle_id = uuid.uuid4()
    team_id = uuid.uuid4()
    user_id = uuid.uuid4()
    row_id = uuid.uuid4()

    project_repo = AsyncMock()
    project_repo.find_by_id = AsyncMock(return_value=_project(tenant_id, project_id))
    capacity_repo = AsyncMock()
    capacity_repo.list_by_project = AsyncMock(
        return_value=[
            SimpleNamespace(
                id=row_id,
                project_id=project_id,
                cycle_id=cycle_id,
                team_id=team_id,
                user_id=user_id,
                capacity_value=12.0,
                unit="hours",
                created_at=None,
                updated_at=None,
            )
        ]
    )

    handler = ListCapacityByProjectHandler(capacity_repo=capacity_repo, project_repo=project_repo)
    out = await handler.handle(
        ListCapacityByProject(
            tenant_id=tenant_id,
            project_id=project_id,
            cycle_id=cycle_id,
            team_id=team_id,
            user_id=user_id,
        )
    )

    assert len(out) == 1
    assert out[0].id == row_id
    capacity_repo.list_by_project.assert_awaited_once_with(
        project_id,
        cycle_id=cycle_id,
        team_id=team_id,
        user_id=user_id,
    )

