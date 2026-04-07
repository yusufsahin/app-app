"""Org API: artifact traceability summary (deploy + SCM)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from alm.config.dependencies import get_mediator
from alm.deployment.api.schemas import (
    ArtifactTraceabilitySummaryResponse,
    TraceabilityEnvironmentItem,
    TraceabilityScmLinkSummaryItem,
)
from alm.deployment.application.queries.get_artifact_traceability_summary import GetArtifactTraceabilitySummary
from alm.orgs.api._router_deps import CurrentUser, Mediator, ResolvedOrg, require_manifest_acl, require_permission, resolve_org

router = APIRouter(tags=["Deployment"])


def _to_response(dto) -> ArtifactTraceabilitySummaryResponse:
    return ArtifactTraceabilitySummaryResponse(
        artifact_id=dto.artifact_id,
        artifact_key=dto.artifact_key,
        environments=[
            TraceabilityEnvironmentItem(
                environment=e.environment,
                last_occurred_at=e.last_occurred_at,
                commit_sha=e.commit_sha,
                image_digest=e.image_digest,
                release_label=e.release_label,
                build_id=e.build_id,
                source=e.source,
                matched_via=e.matched_via,
                deployment_event_id=e.deployment_event_id,
            )
            for e in dto.environments
        ],
        scm_links=[
            TraceabilityScmLinkSummaryItem(
                web_url=s.web_url,
                commit_sha=s.commit_sha,
                provider=s.provider,
                title=s.title,
            )
            for s in dto.scm_links
        ],
    )


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/traceability-summary",
    response_model=ArtifactTraceabilitySummaryResponse,
    summary="Deploy + SCM traceability summary for an artifact",
)
async def get_artifact_traceability_summary(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> ArtifactTraceabilitySummaryResponse:
    dto = await mediator.query(
        GetArtifactTraceabilitySummary(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
        )
    )
    return _to_response(dto)
