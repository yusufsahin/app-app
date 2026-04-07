"""Org API: deployment events (S4a)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from alm.config.dependencies import get_mediator
from alm.deployment.api.schemas import DeploymentEventCreateRequest, DeploymentEventResponse
from alm.deployment.application.commands.create_deployment_event import CreateDeploymentEvent
from alm.deployment.application.queries.list_deployment_events import ListDeploymentEvents
from alm.orgs.api._router_deps import CurrentUser, Mediator, ResolvedOrg, require_permission, resolve_org

router = APIRouter(tags=["Deployment"])


def _to_response(dto) -> DeploymentEventResponse:
    return DeploymentEventResponse(
        id=dto.id,
        project_id=dto.project_id,
        environment=dto.environment,
        occurred_at=dto.occurred_at,
        commit_sha=dto.commit_sha,
        image_digest=dto.image_digest,
        repo_full_name=dto.repo_full_name,
        artifact_keys=dto.artifact_keys,
        release_label=dto.release_label,
        build_id=dto.build_id,
        source=dto.source,
        raw_context=dto.raw_context,
        idempotency_key=dto.idempotency_key,
        created_at=dto.created_at,
    )


@router.get(
    "/projects/{project_id}/deployment-events",
    response_model=list[DeploymentEventResponse],
    summary="List deployment events for a project",
)
async def list_deployment_events(
    project_id: uuid.UUID,
    environment: str | None = Query(None),
    artifact_key: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("project:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[DeploymentEventResponse]:
    dtos = await mediator.query(
        ListDeploymentEvents(
            tenant_id=org.tenant_id,
            project_id=project_id,
            environment=environment,
            artifact_key=artifact_key,
            limit=limit,
        )
    )
    return [_to_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/deployment-events",
    response_model=DeploymentEventResponse,
    status_code=201,
    summary="Record a deployment event",
)
async def create_deployment_event(
    project_id: uuid.UUID,
    body: DeploymentEventCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("project:update"),
    mediator: Mediator = Depends(get_mediator),
) -> DeploymentEventResponse:
    dto = await mediator.send(
        CreateDeploymentEvent(
            tenant_id=org.tenant_id,
            project_id=project_id,
            environment=body.environment,
            occurred_at=body.occurred_at,
            commit_sha=body.commit_sha,
            image_digest=body.image_digest,
            repo_full_name=body.repo_full_name,
            artifact_keys=body.artifact_keys,
            release_label=body.release_label,
            build_id=body.build_id,
            source=body.source,
            raw_context=body.raw_context,
            idempotency_key=body.idempotency_key,
        )
    )
    return _to_response(dto)
