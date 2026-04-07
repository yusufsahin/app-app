from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from alm.artifact.application.dtos import ArtifactDTO
from alm.artifact.application.queries.list_artifacts import ListArtifacts, ListArtifactsResult
from alm.orgs.api import routes_capacity_p7, routes_projects
from alm.orgs.api.routes_capacity_p7 import (
    create_capacity,
    delete_capacity,
    list_capacity,
    update_capacity,
)
from alm.orgs.api.routes_projects import list_artifacts
from alm.orgs.api.routes_tasks_by_artifact import (
    list_tasks_by_artifact,
    list_tasks_by_project_and_assignee,
)
from alm.shared.infrastructure.org_resolver import ResolvedOrg
from alm.shared.infrastructure.security.dependencies import CurrentUser
from alm.task.application.queries.list_tasks_by_artifact import ListTasksByArtifact
from alm.task.application.queries.list_tasks_by_project_and_assignee import (
    ListTasksByProjectAndAssignee,
)
from alm.tenant.application.dtos import TenantDTO


def _org(tenant_id: uuid.UUID) -> ResolvedOrg:
    return ResolvedOrg(
        tenant_id=tenant_id,
        slug="demo",
        dto=TenantDTO(id=tenant_id, name="Demo", slug="demo", tier="free"),
    )


@pytest.mark.asyncio
async def test_capacity_routes_build_expected_queries_and_commands() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    cycle_id = uuid.uuid4()
    team_id = uuid.uuid4()
    user_id = uuid.uuid4()
    capacity_id = uuid.uuid4()
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()

    dto = AsyncMock()
    dto.id = capacity_id
    dto.project_id = project_id
    dto.cycle_id = cycle_id
    dto.team_id = team_id
    dto.user_id = user_id
    dto.capacity_value = 10.0
    dto.unit = "hours"
    dto.created_at = None
    dto.updated_at = None

    mediator.query = AsyncMock(return_value=[dto])
    rows = await list_capacity(
        project_id=project_id,
        cycle_id=cycle_id,
        team_id=team_id,
        user_id=user_id,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    assert len(rows) == 1
    q = mediator.query.await_args.args[0]
    assert q.project_id == project_id
    assert q.cycle_id == cycle_id
    assert q.team_id == team_id
    assert q.user_id == user_id

    create_body = routes_capacity_p7.CapacityCreateRequest(
        cycle_id=cycle_id,
        team_id=team_id,
        user_id=None,
        capacity_value=16,
        unit="hours",
    )
    mediator.send = AsyncMock(return_value=dto)
    await create_capacity(
        project_id=project_id,
        body=create_body,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    c = mediator.send.await_args.args[0]
    assert c.project_id == project_id
    assert c.team_id == team_id
    assert c.user_id is None
    assert c.capacity_value == 16

    update_body = routes_capacity_p7.CapacityUpdateRequest(capacity_value=20)
    await update_capacity(
        project_id=project_id,
        capacity_id=capacity_id,
        body=update_body,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    u = mediator.send.await_args.args[0]
    assert u.capacity_id == capacity_id
    assert u.capacity_value == 20
    assert u.team_id is None

    await delete_capacity(
        project_id=project_id,
        capacity_id=capacity_id,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    d = mediator.send.await_args.args[0]
    assert d.project_id == project_id
    assert d.capacity_id == capacity_id


@pytest.mark.asyncio
async def test_task_list_routes_forward_team_filter() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()
    assignee_id = uuid.uuid4()
    team_id = uuid.uuid4()
    user = CurrentUser(id=assignee_id, tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()
    mediator.query = AsyncMock(return_value=[])

    await list_tasks_by_project_and_assignee(
        project_id=project_id,
        assignee_id="me",
        team_id=team_id,
        org=_org(tenant_id),
        user=user,
        _acl=None,
        mediator=mediator,
    )
    q1 = mediator.query.await_args.args[0]
    assert isinstance(q1, ListTasksByProjectAndAssignee)
    assert q1.team_id == team_id
    assert q1.assignee_id == assignee_id

    await list_tasks_by_artifact(
        project_id=project_id,
        artifact_id=artifact_id,
        team_id=team_id,
        org=_org(tenant_id),
        user=user,
        _acl=None,
        mediator=mediator,
    )
    q2 = mediator.query.await_args.args[0]
    assert isinstance(q2, ListTasksByArtifact)
    assert q2.team_id == team_id
    assert q2.artifact_id == artifact_id


@pytest.mark.asyncio
async def test_artifact_list_route_forwards_team_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    team_id = uuid.uuid4()
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()
    dto = ArtifactDTO(
        id=uuid.uuid4(),
        project_id=project_id,
        artifact_type="story",
        title="T",
        description="",
        state="open",
        assignee_id=None,
        parent_id=None,
        custom_fields={},
    )
    mediator.query = AsyncMock(return_value=ListArtifactsResult(items=[dto], total=1))

    async def _passthrough(items, _user):
        return items

    monkeypatch.setattr(routes_projects, "mask_artifact_list_for_user", _passthrough)

    resp = await list_artifacts(
        project_id=project_id,
        team_id=team_id,
        org=_org(tenant_id),
        user=user,
        _acl=None,
        mediator=mediator,
    )
    assert resp.total == 1
    q = mediator.query.await_args.args[0]
    assert isinstance(q, ListArtifacts)
    assert q.team_id == team_id


@pytest.mark.asyncio
async def test_artifact_list_route_forwards_stale_traceability_only(monkeypatch: pytest.MonkeyPatch) -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()
    dto = ArtifactDTO(
        id=uuid.uuid4(),
        project_id=project_id,
        artifact_type="test-case",
        title="Stale",
        description="",
        state="open",
        assignee_id=None,
        parent_id=None,
        custom_fields={},
    )
    mediator.query = AsyncMock(return_value=ListArtifactsResult(items=[dto], total=1))

    async def _passthrough(items, _user):
        return items

    monkeypatch.setattr(routes_projects, "mask_artifact_list_for_user", _passthrough)

    resp = await list_artifacts(
        project_id=project_id,
        stale_traceability_only=True,
        org=_org(tenant_id),
        user=user,
        _acl=None,
        mediator=mediator,
    )
    assert resp.total == 1
    q = mediator.query.await_args.args[0]
    assert isinstance(q, ListArtifacts)
    assert q.stale_traceability_only is True

