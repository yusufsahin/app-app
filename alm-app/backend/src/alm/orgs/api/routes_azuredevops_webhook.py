"""Azure DevOps Repos service hook: git.push and git.pullrequest.merged create SCM links (S3)."""

from __future__ import annotations

import hmac
import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse, Response

from alm.artifact.infrastructure.repositories import SqlAlchemyArtifactRepository
from alm.config.dependencies import ACTOR_ID_KEY, TENANT_ID_KEY
from alm.orgs.api.scm_webhook_policy import (
    scm_webhook_azuredevops_processing_enabled,
    scm_webhook_push_branch_matches_policy,
)
from alm.orgs.api.scm_webhook_support import (
    SCM_AZURE_DEVOPS_WEBHOOK_SECRET_KEY,
    SCM_WEBHOOK_MAX_BODY_BYTES,
    SCM_WEBHOOK_MAX_PUSH_COMMITS,
    SCM_WEBHOOK_MAX_UNMATCHED_RECORDS_PER_REQUEST,
    artifact_for_pr_fields,
    attach_reason_code_to_webhook_body,
    branch_short_name_from_ref,
    load_project_settings_for_webhook,
    load_tenant_id_for_slug,
    normalize_webhook_delivery_id,
    persist_webhook_unmatched_events,
    record_push_commit_no_artifact_match,
    record_webhook_delivery_processed,
    resolve_task_id_from_refs_trailers_for_artifact,
    webhook_delivery_already_processed,
)
from alm.scm.application.artifact_key_hints import extract_artifact_key_hints
from alm.scm.application.commands.create_scm_link import CreateScmLink
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import ValidationError
from alm.shared.infrastructure.db.session import async_session_factory
from alm.shared.infrastructure.db.tenant_context import get_current_tenant_id, set_current_tenant_id

logger = structlog.get_logger()

_AZURE_DEVOPS_WEBHOOK_OPENAPI_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {
        "description": (
            "JSON body: `status` is ok | created | duplicate | no_match | ignored (with optional `reason`, `reason_code`). "
            "Configure an HTTP header `X-ALM-AzureDevOps-Token` on the service hook to match `settings.scm_azuredevops_webhook_secret`."
        ),
        "content": {"application/json": {"examples": {}}},
    },
    400: {"description": "Body is not valid UTF-8 JSON."},
    401: {"description": "Missing or invalid X-ALM-AzureDevOps-Token."},
    404: {"description": "Unknown org/project or Azure DevOps webhook secret not configured."},
    413: {"description": f"Body larger than {SCM_WEBHOOK_MAX_BODY_BYTES} bytes."},
}

router = APIRouter(tags=["SCM webhooks"])

PROVIDER = "azuredevops"


def _ado_token_valid(provided: str | None, expected: str) -> bool:
    if not provided:
        return False
    p, e = provided.strip(), expected.strip()
    return hmac.compare_digest(p.encode("utf-8"), e.encode("utf-8"))


def _ado_delivery_id(payload: dict[str, Any]) -> str | None:
    nid = payload.get("notificationId")
    if isinstance(nid, int):
        return str(nid)
    if isinstance(nid, str) and nid.strip():
        return nid.strip()[:128]
    eid = payload.get("id")
    if isinstance(eid, str) and eid.strip():
        return eid.strip()[:128]
    return None


def _ado_repo_label(repository: dict[str, Any]) -> str:
    """Best-effort owner/repo string for display (Azure Repos URLs vary)."""
    web = (repository.get("webUrl") or repository.get("remoteUrl") or "").strip()
    if "dev.azure.com" in web or "visualstudio.com" in web:
        return web.split("?", 1)[0].replace("https://", "").replace("http://", "")[:512]
    name = (repository.get("name") or "").strip()
    return name or "azure-devops"


async def _ado_json_record_delivery(
    session: AsyncSession,
    project_id: uuid.UUID,
    delivery_id: str | None,
    body: dict[str, Any],
    *,
    mediator: Mediator | None = None,
) -> JSONResponse:
    await record_webhook_delivery_processed(session, project_id, PROVIDER, delivery_id, commit=False)
    if mediator is not None:
        await mediator.finalize_transaction()
    else:
        await session.commit()
    return JSONResponse(attach_reason_code_to_webhook_body(body))


async def _ado_process_push(
    *,
    session: AsyncSession,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    org_slug: str,
    payload: dict[str, Any],
    settings: dict[str, Any],
    delivery_id: str | None,
) -> JSONResponse:
    resource = payload.get("resource") or {}
    ref_updates = resource.get("refUpdates")
    if not isinstance(ref_updates, list) or not ref_updates:
        return await _ado_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "payload"}
        )
    first = ref_updates[0] if isinstance(ref_updates[0], dict) else {}
    ref_name = str(first.get("name") or "")
    branch = branch_short_name_from_ref(ref_name)
    if branch is None:
        return await _ado_json_record_delivery(session, project_id, delivery_id, {"status": "ignored", "reason": "ref"})
    if not scm_webhook_push_branch_matches_policy(branch, settings):
        logger.info(
            "azuredevops_webhook_ignored",
            org_slug=org_slug,
            project_id=str(project_id),
            reason="branch_policy",
            branch=branch,
        )
        return await _ado_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "branch_policy"}
        )

    repo = resource.get("repository") or {}
    if not isinstance(repo, dict) or not repo:
        return await _ado_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "payload"}
        )
    repo_label = _ado_repo_label(repo)

    raw_commits = resource.get("commits")
    if not isinstance(raw_commits, list):
        raw_commits = []
    commits = [c for c in raw_commits if isinstance(c, dict)][:SCM_WEBHOOK_MAX_PUSH_COMMITS]
    if not commits:
        return await _ado_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "commits"}
        )

    artifact_repo = SqlAlchemyArtifactRepository(session)
    created = dup = no_match = 0
    unmatched_ctx: list[dict[str, Any]] = []
    session.info[TENANT_ID_KEY] = tenant_id
    session.info[ACTOR_ID_KEY] = None
    mediator = Mediator(session)

    for c in commits:
        sha_raw = c.get("commitId") or c.get("id")
        if not isinstance(sha_raw, str) or len(sha_raw) < 7:
            continue
        sha = sha_raw.lower()[:64]
        msg = (c.get("comment") or "").strip() if isinstance(c.get("comment"), str) else ""
        web_url = (c.get("url") or "").strip()
        if not web_url:
            continue

        artifact, key_match_source = await artifact_for_pr_fields(
            project_id=project_id,
            head_ref=branch,
            title=msg,
            body_text="",
            artifact_repo=artifact_repo,
        )
        if artifact is None:
            no_match += 1
            record_push_commit_no_artifact_match(provider=PROVIDER)
            if len(unmatched_ctx) < SCM_WEBHOOK_MAX_UNMATCHED_RECORDS_PER_REQUEST:
                unmatched_ctx.append(
                    {
                        "reason_code": "artifact_not_found",
                        "branch": branch,
                        "commit_sha": sha,
                        "message_excerpt": msg,
                        "web_url": web_url,
                        "repo_full_name": repo_label,
                        "hints_tried": extract_artifact_key_hints(f"{branch}\n{msg}")[:8],
                    }
                )
            continue

        title_line = (msg.split("\n", 1)[0].strip()[:500] or None) if msg else None
        wh_task_id = await resolve_task_id_from_refs_trailers_for_artifact(
            session,
            project_id=project_id,
            artifact_id=artifact.id,
            combined_text=msg,
        )
        try:
            await mediator.send(
                CreateScmLink(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    artifact_id=artifact.id,
                    web_url=web_url,
                    created_by=None,
                    task_id=wh_task_id,
                    provider="azuredevops",
                    repo_full_name=repo_label[:512],
                    ref=branch,
                    commit_sha=sha,
                    pull_request_number=None,
                    title=title_line,
                    source="webhook",
                    key_match_source=key_match_source,
                ),
                commit=False,
            )
            created += 1
        except ValidationError as e:
            if "already linked" in e.detail.lower():
                dup += 1
            else:
                raise

    if unmatched_ctx:
        await persist_webhook_unmatched_events(
            session,
            project_id,
            PROVIDER,
            "azuredevops_push_commit",
            unmatched_ctx,
        )

    logger.info(
        "azuredevops_webhook_push_processed",
        org_slug=org_slug,
        project_id=str(project_id),
        created=created,
        duplicate=dup,
        no_match=no_match,
        webhook_delivery_id=normalize_webhook_delivery_id(delivery_id),
    )
    return await _ado_json_record_delivery(
        session,
        project_id,
        delivery_id,
        {
            "status": "ok",
            "processed": len(commits),
            "created": created,
            "duplicate": dup,
            "no_match": no_match,
        },
        mediator=mediator,
    )


@router.post(
    "/projects/{project_id}/webhooks/azuredevops",
    summary="Azure DevOps Repos SCM webhook",
    description=(
        "Verifies `X-ALM-AzureDevOps-Token` against `settings.scm_azuredevops_webhook_secret`. "
        "Supports `git.push` (resource.commits + refUpdates) and `git.pullrequest.merged`. "
        "Configure the same token as an optional HTTP header on the Azure DevOps service hook subscription."
    ),
    responses=_AZURE_DEVOPS_WEBHOOK_OPENAPI_RESPONSES,
)
async def azuredevops_scm_webhook(
    org_slug: str,
    project_id: uuid.UUID,
    request: Request,
    x_alm_azuredevops_token: Annotated[
        str | None,
        Header(alias="X-ALM-AzureDevOps-Token", description="Must match `settings.scm_azuredevops_webhook_secret`."),
    ] = None,
) -> Response:
    body = await request.body()
    if len(body) > SCM_WEBHOOK_MAX_BODY_BYTES:
        logger.warning(
            "azuredevops_webhook_payload_too_large",
            org_slug=org_slug,
            project_id=str(project_id),
            body_bytes=len(body),
        )
        return Response(status_code=413)

    prev_tenant = get_current_tenant_id()
    try:
        async with async_session_factory() as session:
            tenant_id = await load_tenant_id_for_slug(session, org_slug)
            if tenant_id is None:
                return Response(status_code=404)

            set_current_tenant_id(tenant_id)
            await session.rollback()

            settings = await load_project_settings_for_webhook(session, project_id, tenant_id)
            if settings is None:
                return Response(status_code=404)

            secret_raw = settings.get(SCM_AZURE_DEVOPS_WEBHOOK_SECRET_KEY)
            if not isinstance(secret_raw, str) or not secret_raw.strip():
                return Response(status_code=404)

            secret = secret_raw.strip()
            if not _ado_token_valid(x_alm_azuredevops_token, secret):
                logger.warning(
                    "azuredevops_webhook_bad_token",
                    org_slug=org_slug,
                    project_id=str(project_id),
                )
                return Response(status_code=401)

            try:
                payload: dict[str, Any] = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return Response(status_code=400)

            if not scm_webhook_azuredevops_processing_enabled(settings):
                logger.info(
                    "azuredevops_webhook_ignored",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    reason="disabled",
                )
                return JSONResponse(
                    attach_reason_code_to_webhook_body({"status": "ignored", "reason": "disabled"}),
                )

            delivery_id = _ado_delivery_id(payload)
            if delivery_id and await webhook_delivery_already_processed(session, project_id, PROVIDER, delivery_id):
                logger.info(
                    "azuredevops_webhook_duplicate_delivery",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    webhook_delivery_id=normalize_webhook_delivery_id(delivery_id),
                )
                return JSONResponse(
                    attach_reason_code_to_webhook_body({"status": "ignored", "reason": "duplicate_delivery"}),
                )

            event_type = str(payload.get("eventType") or "")

            if event_type == "git.push":
                return await _ado_process_push(
                    session=session,
                    tenant_id=tenant_id,
                    project_id=project_id,
                    org_slug=org_slug,
                    payload=payload,
                    settings=settings,
                    delivery_id=delivery_id,
                )

            if event_type == "git.pullrequest.merged":
                resource = payload.get("resource") or {}
                if not isinstance(resource, dict):
                    return await _ado_json_record_delivery(
                        session, project_id, delivery_id, {"status": "ignored", "reason": "payload"}
                    )
                repo = resource.get("repository") or {}
                if not isinstance(repo, dict):
                    repo = {}
                repo_label = _ado_repo_label(repo)
                web_url = (resource.get("url") or resource.get("artifactUri") or "").strip()
                if not web_url:
                    pull_request_id = resource.get("pullRequestId")
                    web_base = (repo.get("webUrl") or repo.get("remoteUrl") or "").rstrip("/")
                    if web_base and isinstance(pull_request_id, int):
                        web_url = f"{web_base}/pullrequest/{pull_request_id}"
                head_ref_raw = str(resource.get("sourceRefName") or "").strip()
                head_ref = branch_short_name_from_ref(head_ref_raw) or (
                    head_ref_raw.removeprefix("refs/heads/").strip() if head_ref_raw else ""
                )
                pr_title = str(resource.get("title") or "").strip()
                pr_body = str(resource.get("description") or "").strip()
                if not web_url or not head_ref:
                    return await _ado_json_record_delivery(
                        session, project_id, delivery_id, {"status": "ignored", "reason": "payload"}
                    )

                artifact_repo = SqlAlchemyArtifactRepository(session)
                artifact, key_match_source = await artifact_for_pr_fields(
                    project_id=project_id,
                    head_ref=head_ref,
                    title=pr_title,
                    body_text=pr_body,
                    artifact_repo=artifact_repo,
                )
                if artifact is None:
                    await persist_webhook_unmatched_events(
                        session,
                        project_id,
                        PROVIDER,
                        "azuredevops_pull_request",
                        [
                            {
                                "reason_code": "artifact_not_found",
                                "branch": head_ref,
                                "web_url": web_url,
                                "title": pr_title,
                                "body_excerpt": pr_body,
                                "repo_full_name": repo_label,
                                "hints_tried": extract_artifact_key_hints(f"{head_ref}\n{pr_title}\n{pr_body}")[:8],
                            }
                        ],
                    )
                    return await _ado_json_record_delivery(
                        session, project_id, delivery_id, {"status": "no_match"}
                    )

                pr_num = resource.get("pullRequestId")
                pull_request_number = int(pr_num) if isinstance(pr_num, int) else None

                session.info[TENANT_ID_KEY] = tenant_id
                session.info[ACTOR_ID_KEY] = None
                mediator = Mediator(session)
                pr_refs_text = f"{pr_title}\n{pr_body}"
                wh_task_id = await resolve_task_id_from_refs_trailers_for_artifact(
                    session,
                    project_id=project_id,
                    artifact_id=artifact.id,
                    combined_text=pr_refs_text,
                )
                try:
                    await mediator.send(
                        CreateScmLink(
                            tenant_id=tenant_id,
                            project_id=project_id,
                            artifact_id=artifact.id,
                            web_url=web_url,
                            created_by=None,
                            task_id=wh_task_id,
                            provider="azuredevops",
                            repo_full_name=repo_label[:512],
                            ref=head_ref or None,
                            commit_sha=None,
                            pull_request_number=pull_request_number,
                            title=pr_title or None,
                            source="webhook",
                            key_match_source=key_match_source,
                        ),
                        commit=False,
                    )
                except ValidationError as e:
                    if "already linked" in e.detail.lower():
                        return await _ado_json_record_delivery(
                            session, project_id, delivery_id, {"status": "duplicate"}
                        )
                    raise

                logger.info(
                    "azuredevops_webhook_scm_link_created",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    artifact_id=str(artifact.id),
                )
                return await _ado_json_record_delivery(
                    session, project_id, delivery_id, {"status": "created"}, mediator=mediator
                )

            return JSONResponse(
                attach_reason_code_to_webhook_body({"status": "ignored", "reason": "event"}),
            )
    finally:
        set_current_tenant_id(prev_tenant)
