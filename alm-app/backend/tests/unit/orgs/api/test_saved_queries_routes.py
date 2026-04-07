"""Unit tests: saved query routes forward filter_params into ListArtifacts."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from alm.artifact.application.queries.list_artifacts import ListArtifacts, ListArtifactsResult
from alm.orgs.api.routes_saved_queries import run_saved_query
from alm.saved_query.application.dtos import SavedQueryDTO
from alm.shared.infrastructure.org_resolver import ResolvedOrg
from alm.shared.infrastructure.security.dependencies import CurrentUser
from alm.tenant.application.dtos import TenantDTO


def _org(tenant_id: uuid.UUID) -> ResolvedOrg:
    return ResolvedOrg(
        tenant_id=tenant_id,
        slug="demo",
        dto=TenantDTO(id=tenant_id, name="Demo", slug="demo", tier="free"),
    )


@pytest.mark.asyncio
async def test_run_saved_query_forwards_stale_traceability_only() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    query_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    user = CurrentUser(id=owner_id, tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()

    sq = SavedQueryDTO(
        id=query_id,
        project_id=project_id,
        name="Stale only",
        owner_id=owner_id,
        visibility="private",
        filter_params={"stale_traceability_only": True, "state": "open"},
        created_at=None,
        updated_at=None,
    )
    mediator.query = AsyncMock(side_effect=[sq, ListArtifactsResult(items=[], total=0)])

    resp = await run_saved_query(
        project_id=project_id,
        query_id=query_id,
        limit=20,
        offset=0,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    assert resp.total == 0
    assert mediator.query.await_count == 2
    list_call = mediator.query.await_args_list[1].args[0]
    assert isinstance(list_call, ListArtifacts)
    assert list_call.stale_traceability_only is True
    assert list_call.state_filter == "open"


@pytest.mark.asyncio
async def test_run_saved_query_omits_stale_filter_when_not_in_params() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    query_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    user = CurrentUser(id=owner_id, tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()

    sq = SavedQueryDTO(
        id=query_id,
        project_id=project_id,
        name="All",
        owner_id=owner_id,
        visibility="private",
        filter_params={"type": "task"},
        created_at=None,
        updated_at=None,
    )
    mediator.query = AsyncMock(side_effect=[sq, ListArtifactsResult(items=[], total=0)])

    await run_saved_query(
        project_id=project_id,
        query_id=query_id,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    list_call = mediator.query.await_args_list[1].args[0]
    assert isinstance(list_call, ListArtifacts)
    assert list_call.stale_traceability_only is False


@pytest.mark.asyncio
async def test_run_saved_query_forwards_limit_offset_from_filter_params() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    query_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    user = CurrentUser(id=owner_id, tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()

    sq = SavedQueryDTO(
        id=query_id,
        project_id=project_id,
        name="Paged",
        owner_id=owner_id,
        visibility="private",
        filter_params={"limit": 50, "offset": 15, "q": "findme"},
        created_at=None,
        updated_at=None,
    )
    mediator.query = AsyncMock(side_effect=[sq, ListArtifactsResult(items=[], total=0)])

    await run_saved_query(
        project_id=project_id,
        query_id=query_id,
        limit=20,
        offset=0,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    list_call = mediator.query.await_args_list[1].args[0]
    assert isinstance(list_call, ListArtifacts)
    assert list_call.limit == 50
    assert list_call.offset == 15
    assert list_call.search_query == "findme"


@pytest.mark.asyncio
async def test_run_saved_query_stale_false_in_params_disables_stale_filter() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    query_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    user = CurrentUser(id=owner_id, tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()

    sq = SavedQueryDTO(
        id=query_id,
        project_id=project_id,
        name="Explicit off",
        owner_id=owner_id,
        visibility="private",
        filter_params={"stale_traceability_only": False},
        created_at=None,
        updated_at=None,
    )
    mediator.query = AsyncMock(side_effect=[sq, ListArtifactsResult(items=[], total=0)])

    await run_saved_query(
        project_id=project_id,
        query_id=query_id,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    list_call = mediator.query.await_args_list[1].args[0]
    assert isinstance(list_call, ListArtifacts)
    assert list_call.stale_traceability_only is False


@pytest.mark.asyncio
async def test_run_saved_query_invalid_uuid_ids_become_none() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    query_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    user = CurrentUser(id=owner_id, tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()

    sq = SavedQueryDTO(
        id=query_id,
        project_id=project_id,
        name="Bad uuids",
        owner_id=owner_id,
        visibility="private",
        filter_params={
            "cycle_id": "not-a-uuid",
            "release_id": "also-bad",
            "area_node_id": "nope",
        },
        created_at=None,
        updated_at=None,
    )
    mediator.query = AsyncMock(side_effect=[sq, ListArtifactsResult(items=[], total=0)])

    await run_saved_query(
        project_id=project_id,
        query_id=query_id,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    list_call = mediator.query.await_args_list[1].args[0]
    assert isinstance(list_call, ListArtifacts)
    assert list_call.cycle_id is None
    assert list_call.release_id is None
    assert list_call.area_node_id is None


@pytest.mark.asyncio
async def test_run_saved_query_parses_valid_uuid_strings_from_filter_params() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    query_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    cycle_id = uuid.uuid4()
    release_id = uuid.uuid4()
    area_id = uuid.uuid4()
    user = CurrentUser(id=owner_id, tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()

    sq = SavedQueryDTO(
        id=query_id,
        project_id=project_id,
        name="Uuids",
        owner_id=owner_id,
        visibility="private",
        filter_params={
            "cycle_id": str(cycle_id),
            "release_id": str(release_id),
            "area_node_id": str(area_id),
        },
        created_at=None,
        updated_at=None,
    )
    mediator.query = AsyncMock(side_effect=[sq, ListArtifactsResult(items=[], total=0)])

    await run_saved_query(
        project_id=project_id,
        query_id=query_id,
        org=_org(tenant_id),
        user=user,
        mediator=mediator,
    )
    list_call = mediator.query.await_args_list[1].args[0]
    assert isinstance(list_call, ListArtifacts)
    assert list_call.cycle_id == cycle_id
    assert list_call.release_id == release_id
    assert list_call.area_node_id == area_id
