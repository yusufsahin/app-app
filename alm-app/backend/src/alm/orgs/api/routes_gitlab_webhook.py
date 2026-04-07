"""GitLab webhook: Merge Request and Push hooks create SCM links (S3)."""

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
    scm_webhook_gitlab_processing_enabled,
    scm_webhook_push_branch_matches_policy,
)
from alm.orgs.api.scm_webhook_support import (
    SCM_GITLAB_WEBHOOK_SECRET_KEY,
    SCM_WEBHOOK_MAX_BODY_BYTES,
    SCM_WEBHOOK_MAX_PUSH_COMMITS,
    SCM_WEBHOOK_MAX_UNMATCHED_RECORDS_PER_REQUEST,
    artifact_for_pr_fields,
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

_GITLAB_WEBHOOK_OPENAPI_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {
        "description": (
            "JSON body: `status` is ok | created | duplicate | no_match | ignored (with optional `reason`, counters). "
            "If `X-Gitlab-Event-UUID` repeats after a prior successful terminal response for the same project, "
            "`ignored` + `reason: duplicate_delivery` (provider retry idempotency)."
        ),
        "content": {
            "application/json": {
                "examples": {
                    "ignored": {"summary": "policy", "value": {"status": "ignored", "reason": "disabled"}},
                    "dup_delivery": {
                        "summary": "idempotency",
                        "value": {"status": "ignored", "reason": "duplicate_delivery"},
                    },
                }
            }
        },
    },
    400: {"description": "Body is not valid UTF-8 JSON."},
    401: {"description": "Missing or invalid X-Gitlab-Token."},
    404: {"description": "Unknown org/project or GitLab webhook secret not configured."},
    413: {"description": f"Body larger than {SCM_WEBHOOK_MAX_BODY_BYTES} bytes."},
}

router = APIRouter(tags=["SCM webhooks"])


def _gitlab_token_valid(provided: str | None, expected: str) -> bool:
    if not provided:
        return False
    p, e = provided.strip(), expected.strip()
    return hmac.compare_digest(p.encode("utf-8"), e.encode("utf-8"))


def _gitlab_mr_should_process(action: str, state: str) -> bool:
    a, s = (action or "").lower(), (state or "").lower()
    if a == "close":
        return s == "merged"
    return a in ("open", "reopen", "update", "merge")


def _gitlab_commit_web_url(project: dict[str, Any], commit: dict[str, Any], sha: str) -> str:
    u = (commit.get("url") or "").strip()
    if u and u.startswith("http"):
        return u
    base = (project.get("web_url") or "").rstrip("/")
    if base:
        return f"{base}/-/commit/{sha}"
    return ""


async def _gitlab_json_record_delivery(
    session: AsyncSession,
    project_id: uuid.UUID,
    delivery_id: str | None,
    body: dict[str, Any],
) -> JSONResponse:
    await record_webhook_delivery_processed(session, project_id, "gitlab", delivery_id)
    return JSONResponse(body)


async def _gitlab_process_push(
    *,
    session: AsyncSession,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    org_slug: str,
    payload: dict[str, Any],
    settings: dict[str, Any],
    delivery_id: str | None = None,
) -> Response:
    ref = payload.get("ref")
    branch = branch_short_name_from_ref(ref if isinstance(ref, str) else None)
    if branch is None:
        return await _gitlab_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "ref"}
        )
    if not scm_webhook_push_branch_matches_policy(branch, settings):
        logger.info(
            "gitlab_webhook_ignored",
            org_slug=org_slug,
            project_id=str(project_id),
            reason="branch_policy",
            branch=branch,
        )
        return await _gitlab_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "branch_policy"}
        )

    proj = payload.get("project") or {}
    repo_full = (proj.get("path_with_namespace") or "").strip()
    if not repo_full:
        return await _gitlab_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "payload"}
        )

    raw_commits = payload.get("commits")
    if not isinstance(raw_commits, list):
        raw_commits = []

    commits = [c for c in raw_commits if isinstance(c, dict)][:SCM_WEBHOOK_MAX_PUSH_COMMITS]
    if not commits:
        return await _gitlab_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "commits"}
        )

    artifact_repo = SqlAlchemyArtifactRepository(session)
    created = dup = no_match = 0
    unmatched_ctx: list[dict[str, Any]] = []
    session.info[TENANT_ID_KEY] = tenant_id
    session.info[ACTOR_ID_KEY] = None
    mediator = Mediator(session)

    for c in commits:
        sha_raw = c.get("id")
        if not isinstance(sha_raw, str) or len(sha_raw) < 7:
            continue
        sha = sha_raw.lower()[:64]
        msg = (c.get("message") or "").strip() if isinstance(c.get("message"), str) else ""
        web_url = _gitlab_commit_web_url(proj, c, sha)
        if not web_url:
            continue

        artifact = await artifact_for_pr_fields(
            project_id=project_id,
            head_ref=branch,
            title=msg,
            body_text="",
            artifact_repo=artifact_repo,
        )
        if artifact is None:
            no_match += 1
            record_push_commit_no_artifact_match(provider="gitlab")
            if len(unmatched_ctx) < SCM_WEBHOOK_MAX_UNMATCHED_RECORDS_PER_REQUEST:
                unmatched_ctx.append(
                    {
                        "branch": branch,
                        "commit_sha": sha,
                        "message_excerpt": msg,
                        "web_url": web_url,
                        "repo_full_name": repo_full,
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
                    provider="gitlab",
                    repo_full_name=repo_full,
                    ref=branch,
                    commit_sha=sha,
                    pull_request_number=None,
                    title=title_line,
                    source="webhook",
                )
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
            "gitlab",
            "gitlab_push_commit",
            unmatched_ctx,
        )
        await session.commit()

    logger.info(
        "gitlab_webhook_push_processed",
        org_slug=org_slug,
        project_id=str(project_id),
        created=created,
        duplicate=dup,
        no_match=no_match,
        webhook_delivery_id=normalize_webhook_delivery_id(delivery_id),
    )
    return await _gitlab_json_record_delivery(
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
    )


@router.post(
    "/projects/{project_id}/webhooks/gitlab",
    summary="GitLab SCM webhook",
    description=(
        "Verifies `X-Gitlab-Token` against `settings.scm_gitlab_webhook_secret`. "
        "Supports Merge Request Hook and Push Hook. Optional policy: see PLAN_SCM_TRACEABILITY / manifest-schema. "
        "Optional `X-Gitlab-Event-UUID`: duplicate provider deliveries return `duplicate_delivery` after a successful run."
    ),
    responses=_GITLAB_WEBHOOK_OPENAPI_RESPONSES,
)
async def gitlab_scm_webhook(
    org_slug: str,
    project_id: uuid.UUID,
    request: Request,
    x_gitlab_token: Annotated[
        str | None,
        Header(
            alias="X-Gitlab-Token",
            description="Must match `settings.scm_gitlab_webhook_secret`.",
        ),
    ] = None,
    x_gitlab_event: Annotated[
        str | None,
        Header(
            alias="X-Gitlab-Event",
            description="`Merge Request Hook` or `Push Hook` for SCM link automation.",
        ),
    ] = None,
    x_gitlab_event_uuid: Annotated[
        str | None,
        Header(
            alias="X-Gitlab-Event-UUID",
            description="Unique delivery id; same value after a prior successful HTTP 200 is answered with `duplicate_delivery`.",
        ),
    ] = None,
) -> Response:
    body = await request.body()
    if len(body) > SCM_WEBHOOK_MAX_BODY_BYTES:
        logger.warning(
            "gitlab_webhook_payload_too_large",
            org_slug=org_slug,
            project_id=str(project_id),
            body_bytes=len(body),
            limit=SCM_WEBHOOK_MAX_BODY_BYTES,
            webhook_delivery_id=normalize_webhook_delivery_id(x_gitlab_event_uuid),
        )
        return Response(status_code=413)

    event = x_gitlab_event or ""
    token = x_gitlab_token

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

            secret_raw = settings.get(SCM_GITLAB_WEBHOOK_SECRET_KEY)
            if not isinstance(secret_raw, str) or not secret_raw.strip():
                return Response(status_code=404)

            secret = secret_raw.strip()
            if not _gitlab_token_valid(token, secret):
                logger.warning(
                    "gitlab_webhook_bad_token",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    webhook_delivery_id=normalize_webhook_delivery_id(x_gitlab_event_uuid),
                )
                return Response(status_code=401)

            if event in ("Merge Request Hook", "Push Hook") and not scm_webhook_gitlab_processing_enabled(settings):
                logger.info(
                    "gitlab_webhook_ignored",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    reason="disabled",
                    gitlab_event=event,
                )
                return JSONResponse({"status": "ignored", "reason": "disabled"})

            if event not in ("Merge Request Hook", "Push Hook"):
                return JSONResponse({"status": "ignored", "reason": "event"})

            try:
                payload: dict[str, Any] = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return Response(status_code=400)

            gl_delivery_header = x_gitlab_event_uuid

            if event == "Push Hook":
                if payload.get("object_kind") != "push":
                    return await _gitlab_json_record_delivery(
                        session,
                        project_id,
                        gl_delivery_header,
                        {"status": "ignored", "reason": "object_kind"},
                    )
                if gl_delivery_header and await webhook_delivery_already_processed(
                    session, project_id, "gitlab", gl_delivery_header
                ):
                    logger.info(
                        "gitlab_webhook_duplicate_delivery",
                        org_slug=org_slug,
                        project_id=str(project_id),
                        webhook_delivery_id=normalize_webhook_delivery_id(gl_delivery_header),
                    )
                    return JSONResponse({"status": "ignored", "reason": "duplicate_delivery"})
                return await _gitlab_process_push(
                    session=session,
                    tenant_id=tenant_id,
                    project_id=project_id,
                    org_slug=org_slug,
                    payload=payload,
                    settings=settings,
                    delivery_id=gl_delivery_header,
                )

            if payload.get("object_kind") != "merge_request":
                return await _gitlab_json_record_delivery(
                    session,
                    project_id,
                    gl_delivery_header,
                    {"status": "ignored", "reason": "object_kind"},
                )

            if gl_delivery_header and await webhook_delivery_already_processed(
                session, project_id, "gitlab", gl_delivery_header
            ):
                logger.info(
                    "gitlab_webhook_duplicate_delivery",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    webhook_delivery_id=normalize_webhook_delivery_id(gl_delivery_header),
                )
                return JSONResponse({"status": "ignored", "reason": "duplicate_delivery"})

            obj = payload.get("object_attributes") or {}
            action = str(obj.get("action") or "")
            state = str(obj.get("state") or "")
            if not _gitlab_mr_should_process(action, state):
                return await _gitlab_json_record_delivery(
                    session, project_id, gl_delivery_header, {"status": "ignored", "reason": "action"}
                )

            proj = payload.get("project") or {}
            repo_full = (proj.get("path_with_namespace") or "").strip()
            web_url = (obj.get("web_url") or obj.get("url") or "").strip()
            if not repo_full or not web_url:
                return await _gitlab_json_record_delivery(
                    session, project_id, gl_delivery_header, {"status": "ignored", "reason": "payload"}
                )

            head_ref = (obj.get("source_branch") or "").strip()
            mr_title = (obj.get("title") or "").strip()
            mr_description = (obj.get("description") or "").strip()

            artifact_repo = SqlAlchemyArtifactRepository(session)
            artifact = await artifact_for_pr_fields(
                project_id=project_id,
                head_ref=head_ref,
                title=mr_title,
                body_text=mr_description,
                artifact_repo=artifact_repo,
            )
            if artifact is None:
                await persist_webhook_unmatched_events(
                    session,
                    project_id,
                    "gitlab",
                    "gitlab_merge_request",
                    [
                        {
                            "branch": head_ref,
                            "web_url": web_url,
                            "title": mr_title,
                            "body_excerpt": mr_description,
                            "repo_full_name": repo_full,
                            "hints_tried": extract_artifact_key_hints(f"{head_ref}\n{mr_title}\n{mr_description}")[:8],
                        }
                    ],
                )
                await session.commit()
                return await _gitlab_json_record_delivery(
                    session, project_id, gl_delivery_header, {"status": "no_match"}
                )

            iid = obj.get("iid")
            pull_request_number: int | None
            if isinstance(iid, int):
                pull_request_number = iid
            elif isinstance(iid, str) and iid.isdigit():
                pull_request_number = int(iid)
            else:
                pull_request_number = None

            session.info[TENANT_ID_KEY] = tenant_id
            session.info[ACTOR_ID_KEY] = None
            mediator = Mediator(session)
            mr_refs_text = f"{mr_title}\n{mr_description}"
            wh_task_id = await resolve_task_id_from_refs_trailers_for_artifact(
                session,
                project_id=project_id,
                artifact_id=artifact.id,
                combined_text=mr_refs_text,
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
                        provider="gitlab",
                        repo_full_name=repo_full,
                        ref=head_ref or None,
                        commit_sha=None,
                        pull_request_number=pull_request_number,
                        title=mr_title or None,
                        source="webhook",
                    )
                )
            except ValidationError as e:
                if "already linked" in e.detail.lower():
                    return await _gitlab_json_record_delivery(
                        session, project_id, gl_delivery_header, {"status": "duplicate"}
                    )
                raise

            logger.info(
                "gitlab_webhook_scm_link_created",
                org_slug=org_slug,
                project_id=str(project_id),
                artifact_id=str(artifact.id),
                webhook_delivery_id=normalize_webhook_delivery_id(gl_delivery_header),
            )
            return await _gitlab_json_record_delivery(session, project_id, gl_delivery_header, {"status": "created"})
    finally:
        set_current_tenant_id(prev_tenant)
