"""Unit tests: traceability summary route builds query and maps response."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from alm.deployment.application.queries.get_artifact_traceability_summary import GetArtifactTraceabilitySummary
from alm.deployment.application.traceability_dtos import (
    ArtifactTraceabilitySummaryDTO,
    EnvironmentDeploySummaryDTO,
    ScmLinkSummaryItemDTO,
)
from alm.orgs.api.routes_artifact_traceability_summary import get_artifact_traceability_summary
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
async def test_get_artifact_traceability_summary_forwards_query_and_maps_dto() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()
    dto = ArtifactTraceabilitySummaryDTO(
        artifact_id=artifact_id,
        artifact_key="REQ-1",
        environments=[],
        scm_links=[],
    )
    mediator.query = AsyncMock(return_value=dto)

    resp = await get_artifact_traceability_summary(
        project_id=project_id,
        artifact_id=artifact_id,
        org=_org(tenant_id),
        _user=user,
        _acl=None,
        mediator=mediator,
    )

    assert resp.artifact_id == artifact_id
    assert resp.artifact_key == "REQ-1"
    assert resp.environments == []
    assert resp.scm_links == []
    q = mediator.query.await_args.args[0]
    assert isinstance(q, GetArtifactTraceabilitySummary)
    assert q.tenant_id == tenant_id
    assert q.project_id == project_id
    assert q.artifact_id == artifact_id


@pytest.mark.asyncio
async def test_get_artifact_traceability_summary_maps_nested_dto_fields() -> None:
    tenant_id = uuid.uuid4()
    project_id = uuid.uuid4()
    artifact_id = uuid.uuid4()
    dep_id = uuid.uuid4()
    user = CurrentUser(id=uuid.uuid4(), tenant_id=tenant_id, roles=["member"])
    mediator = AsyncMock()
    dto = ArtifactTraceabilitySummaryDTO(
        artifact_id=artifact_id,
        artifact_key=None,
        environments=[
            EnvironmentDeploySummaryDTO(
                environment="prod",
                last_occurred_at="2026-04-01T00:00:00Z",
                commit_sha="a" * 40,
                image_digest=None,
                release_label="1.0",
                build_id="b1",
                source="ci_webhook",
                matched_via="commit_sha",
                deployment_event_id=dep_id,
            )
        ],
        scm_links=[
            ScmLinkSummaryItemDTO(
                web_url="https://github.com/o/r/pull/2",
                commit_sha=None,
                provider="github",
                title="Fix",
            )
        ],
    )
    mediator.query = AsyncMock(return_value=dto)

    resp = await get_artifact_traceability_summary(
        project_id=project_id,
        artifact_id=artifact_id,
        org=_org(tenant_id),
        _user=user,
        _acl=None,
        mediator=mediator,
    )

    assert len(resp.environments) == 1
    e = resp.environments[0]
    assert e.environment == "prod"
    assert e.matched_via == "commit_sha"
    assert e.deployment_event_id == dep_id
    assert len(resp.scm_links) == 1
    assert resp.scm_links[0].web_url.endswith("/pull/2")
    assert resp.scm_links[0].title == "Fix"
