"""Org API routes: SCM links scoped by artifact."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from alm.config.dependencies import get_mediator
from alm.orgs.api._router_deps import (
    CurrentUser,
    Mediator,
    ResolvedOrg,
    require_manifest_acl,
    require_permission,
    resolve_org,
)
from alm.scm.api.schemas import (
    ScmLinkCreateRequest,
    ScmLinkParsePreviewKeyMatch,
    ScmLinkParsePreviewRequest,
    ScmLinkParsePreviewResponse,
    ScmLinkResponse,
)
from alm.scm.application.commands.create_scm_link import CreateScmLink
from alm.scm.application.commands.delete_scm_link import DeleteScmLink
from alm.scm.application.dtos import ScmLinkDTO, ScmUrlPreviewDTO
from alm.scm.application.queries.list_scm_links_by_artifact import ListScmLinksByArtifact
from alm.scm.application.queries.preview_scm_url import PreviewScmUrl

router = APIRouter(tags=["SCM webhooks"])


def scm_url_preview_response(d: ScmUrlPreviewDTO) -> ScmLinkParsePreviewResponse:
    return ScmLinkParsePreviewResponse(
        canonical_web_url=d.canonical_web_url,
        recognized=d.recognized,
        provider=d.provider,
        repo_full_name=d.repo_full_name,
        pull_request_number=d.pull_request_number,
        commit_sha=d.commit_sha,
        suggested_title=d.suggested_title,
        artifact_key_hints=list(d.artifact_key_hints),
        artifact_key_matches=[
            ScmLinkParsePreviewKeyMatch(
                hint=m.hint,
                artifact_id=m.artifact_id,
                artifact_key=m.artifact_key,
                title=m.title,
                is_current_artifact=m.is_current_artifact,
            )
            for m in d.artifact_key_matches
        ],
        artifact_key_unmatched=list(d.artifact_key_unmatched),
        duplicate_link_id=d.duplicate_link_id,
        duplicate_kind=d.duplicate_kind,
    )


def scm_link_response(d: ScmLinkDTO) -> ScmLinkResponse:
    return ScmLinkResponse(
        id=d.id,
        project_id=d.project_id,
        artifact_id=d.artifact_id,
        task_id=d.task_id,
        provider=d.provider,
        repo_full_name=d.repo_full_name,
        ref=d.ref,
        commit_sha=d.commit_sha,
        pull_request_number=d.pull_request_number,
        title=d.title,
        web_url=d.web_url,
        source=d.source,
        created_by=d.created_by,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


@router.get(
    "/projects/{project_id}/artifacts/{artifact_id}/scm-links",
    response_model=list[ScmLinkResponse],
    summary="List SCM links for artifact",
)
async def list_scm_links_by_artifact(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    task_id: uuid.UUID | None = Query(None, description="If set, only links tied to this task"),
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[ScmLinkResponse]:
    dtos = await mediator.query(
        ListScmLinksByArtifact(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            task_id=task_id,
        )
    )
    return [scm_link_response(d) for d in dtos]


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/scm-links/parse-preview",
    response_model=ScmLinkParsePreviewResponse,
    summary="Preview SCM URL parse and key hints",
)
async def parse_preview_scm_url(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ScmLinkParsePreviewRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:read"),
    _acl: None = require_manifest_acl("artifact", "read"),
    mediator: Mediator = Depends(get_mediator),
) -> ScmLinkParsePreviewResponse:
    dto = await mediator.query(
        PreviewScmUrl(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            web_url=body.web_url,
            context_text=body.context_text,
        )
    )
    return scm_url_preview_response(dto)


@router.post(
    "/projects/{project_id}/artifacts/{artifact_id}/scm-links",
    response_model=ScmLinkResponse,
    status_code=201,
    summary="Create SCM link (manual)",
)
async def create_scm_link(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    body: ScmLinkCreateRequest,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> ScmLinkResponse:
    src = (body.source or "manual").strip().lower()
    if src not in ("manual", "ci"):
        src = "manual"
    dto = await mediator.send(
        CreateScmLink(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            web_url=body.web_url,
            created_by=user.id,
            task_id=body.task_id,
            provider=body.provider,
            repo_full_name=body.repo_full_name,
            ref=body.ref,
            commit_sha=body.commit_sha,
            pull_request_number=body.pull_request_number,
            title=body.title,
            source=src,
        )
    )
    return scm_link_response(dto)


@router.delete(
    "/projects/{project_id}/artifacts/{artifact_id}/scm-links/{link_id}",
    status_code=204,
    summary="Delete SCM link",
)
async def delete_scm_link(
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    link_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("artifact:update"),
    _acl: None = require_manifest_acl("artifact", "update"),
    mediator: Mediator = Depends(get_mediator),
) -> None:
    await mediator.send(
        DeleteScmLink(
            tenant_id=org.tenant_id,
            project_id=project_id,
            artifact_id=artifact_id,
            link_id=link_id,
        )
    )
