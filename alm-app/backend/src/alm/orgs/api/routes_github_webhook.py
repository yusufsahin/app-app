"""GitHub webhook: PR and push events create SCM links (S3)."""

from __future__ import annotations

import hashlib
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
    scm_webhook_github_processing_enabled,
    scm_webhook_push_branch_matches_policy,
)
from alm.orgs.api.scm_webhook_support import (
    SCM_GITHUB_WEBHOOK_SECRET_KEY,
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

_GITHUB_WEBHOOK_OPENAPI_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {
        "description": (
            "JSON body: `status` is ok | created | duplicate | no_match | ignored (with optional `reason`, counters). "
            "If `X-GitHub-Delivery` repeats after a prior successful terminal response for the same project, "
            "`ignored` + `reason: duplicate_delivery` (provider retry idempotency)."
        ),
        "content": {
            "application/json": {
                "examples": {
                    "ping_ok": {"summary": "ping", "value": {"status": "ok"}},
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
    401: {"description": "Missing or invalid X-Hub-Signature-256."},
    404: {"description": "Unknown org/project or GitHub webhook secret not configured."},
    413: {"description": f"Body larger than {SCM_WEBHOOK_MAX_BODY_BYTES} bytes."},
}

router = APIRouter(tags=["SCM webhooks"])


def _github_signature_valid(secret: str, body: bytes, signature_header: str | None) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    expected = f"sha256={mac}"
    return hmac.compare_digest(expected, signature_header.lower())


async def _github_json_record_delivery(
    session: AsyncSession,
    project_id: uuid.UUID,
    delivery_id: str | None,
    body: dict[str, Any],
) -> JSONResponse:
    await record_webhook_delivery_processed(session, project_id, "github", delivery_id)
    return JSONResponse(body)


async def _github_process_push(
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
        return await _github_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "ref"}
        )
    if not scm_webhook_push_branch_matches_policy(branch, settings):
        logger.info(
            "github_webhook_ignored",
            org_slug=org_slug,
            project_id=str(project_id),
            reason="branch_policy",
            branch=branch,
        )
        return await _github_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "branch_policy"}
        )

    repo = payload.get("repository") or {}
    repo_full = (repo.get("full_name") or "").strip()
    if not repo_full:
        return await _github_json_record_delivery(
            session, project_id, delivery_id, {"status": "ignored", "reason": "payload"}
        )

    raw_commits = payload.get("commits")
    if not isinstance(raw_commits, list):
        raw_commits = []

    commits = [c for c in raw_commits if isinstance(c, dict) and c.get("distinct") is not False][
        :SCM_WEBHOOK_MAX_PUSH_COMMITS
    ]

    if not commits:
        return await _github_json_record_delivery(
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
        web_url = f"https://github.com/{repo_full}/commit/{sha}"

        artifact = await artifact_for_pr_fields(
            project_id=project_id,
            head_ref=branch,
            title=msg,
            body_text="",
            artifact_repo=artifact_repo,
        )
        if artifact is None:
            no_match += 1
            record_push_commit_no_artifact_match(provider="github")
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
                    provider="github",
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
            "github",
            "github_push_commit",
            unmatched_ctx,
        )
        await session.commit()

    logger.info(
        "github_webhook_push_processed",
        org_slug=org_slug,
        project_id=str(project_id),
        created=created,
        duplicate=dup,
        no_match=no_match,
        webhook_delivery_id=normalize_webhook_delivery_id(delivery_id),
    )
    return await _github_json_record_delivery(
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
    "/projects/{project_id}/webhooks/github",
    summary="GitHub SCM webhook",
    description=(
        "Verifies `X-Hub-Signature-256` (HMAC-SHA256) with `settings.scm_github_webhook_secret`. "
        "Supports `ping`, `pull_request`, and `push`. Optional policy: see PLAN_SCM_TRACEABILITY / manifest-schema. "
        "Optional `X-GitHub-Delivery`: duplicate provider deliveries return `duplicate_delivery` after a successful run."
    ),
    responses=_GITHUB_WEBHOOK_OPENAPI_RESPONSES,
)
async def github_scm_webhook(
    org_slug: str,
    project_id: uuid.UUID,
    request: Request,
    x_hub_signature_256: Annotated[
        str | None,
        Header(
            alias="X-Hub-Signature-256",
            description="HMAC-SHA256 of the raw request body, format `sha256=<hex>`.",
        ),
    ] = None,
    x_github_event: Annotated[
        str | None,
        Header(
            alias="X-GitHub-Event",
            description="GitHub event name (`ping`, `pull_request`, `push`, …).",
        ),
    ] = None,
    x_github_delivery: Annotated[
        str | None,
        Header(
            alias="X-GitHub-Delivery",
            description="Unique delivery id; same value after a prior successful HTTP 200 is answered with `duplicate_delivery`.",
        ),
    ] = None,
) -> Response:
    body = await request.body()
    if len(body) > SCM_WEBHOOK_MAX_BODY_BYTES:
        logger.warning(
            "github_webhook_payload_too_large",
            org_slug=org_slug,
            project_id=str(project_id),
            body_bytes=len(body),
            limit=SCM_WEBHOOK_MAX_BODY_BYTES,
            webhook_delivery_id=normalize_webhook_delivery_id(x_github_delivery),
        )
        return Response(status_code=413)

    event = x_github_event or ""
    sig = x_hub_signature_256

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

            secret_raw = settings.get(SCM_GITHUB_WEBHOOK_SECRET_KEY)
            if not isinstance(secret_raw, str) or not secret_raw.strip():
                return Response(status_code=404)

            secret = secret_raw.strip()
            if not _github_signature_valid(secret, body, sig):
                logger.warning(
                    "github_webhook_bad_signature",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    webhook_delivery_id=normalize_webhook_delivery_id(x_github_delivery),
                )
                return Response(status_code=401)

            if event == "ping":
                return JSONResponse({"status": "ok"})

            if event not in ("pull_request", "push"):
                return JSONResponse({"status": "ignored", "reason": "event"})

            if not scm_webhook_github_processing_enabled(settings):
                logger.info(
                    "github_webhook_ignored",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    reason="disabled",
                    github_event=event,
                )
                return JSONResponse({"status": "ignored", "reason": "disabled"})

            try:
                payload: dict[str, Any] = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return Response(status_code=400)

            gh_delivery_header = x_github_delivery
            if gh_delivery_header and await webhook_delivery_already_processed(
                session, project_id, "github", gh_delivery_header
            ):
                logger.info(
                    "github_webhook_duplicate_delivery",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    webhook_delivery_id=normalize_webhook_delivery_id(gh_delivery_header),
                )
                return JSONResponse({"status": "ignored", "reason": "duplicate_delivery"})

            if event == "push":
                return await _github_process_push(
                    session=session,
                    tenant_id=tenant_id,
                    project_id=project_id,
                    org_slug=org_slug,
                    payload=payload,
                    settings=settings,
                    delivery_id=gh_delivery_header,
                )

            action = payload.get("action")
            pr = payload.get("pull_request") or {}
            if action == "closed" and not pr.get("merged"):
                return await _github_json_record_delivery(
                    session,
                    project_id,
                    gh_delivery_header,
                    {"status": "ignored", "reason": "closed_not_merged"},
                )
            if action not in ("opened", "reopened", "synchronize", "closed"):
                return await _github_json_record_delivery(
                    session, project_id, gh_delivery_header, {"status": "ignored", "reason": "action"}
                )

            repo = payload.get("repository") or {}
            repo_full = (repo.get("full_name") or "").strip()
            html_url = (pr.get("html_url") or "").strip()
            if not repo_full or not html_url:
                return await _github_json_record_delivery(
                    session, project_id, gh_delivery_header, {"status": "ignored", "reason": "payload"}
                )

            head = pr.get("head") or {}
            head_ref = (head.get("ref") or "").strip()
            pr_title = (pr.get("title") or "").strip()
            pr_body = (pr.get("body") or "").strip()

            artifact_repo = SqlAlchemyArtifactRepository(session)
            artifact = await artifact_for_pr_fields(
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
                    "github",
                    "github_pull_request",
                    [
                        {
                            "branch": head_ref,
                            "web_url": html_url,
                            "title": pr_title,
                            "body_excerpt": pr_body,
                            "repo_full_name": repo_full,
                            "hints_tried": extract_artifact_key_hints(f"{head_ref}\n{pr_title}\n{pr_body}")[:8],
                        }
                    ],
                )
                await session.commit()
                return await _github_json_record_delivery(
                    session, project_id, gh_delivery_header, {"status": "no_match"}
                )

            pr_number = pr.get("number")
            pull_request_number = int(pr_number) if isinstance(pr_number, int) else None

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
                        web_url=html_url,
                        created_by=None,
                        task_id=wh_task_id,
                        provider="github",
                        repo_full_name=repo_full,
                        ref=head_ref or None,
                        commit_sha=None,
                        pull_request_number=pull_request_number,
                        title=pr_title or None,
                        source="webhook",
                    )
                )
            except ValidationError as e:
                if "already linked" in e.detail.lower():
                    return await _github_json_record_delivery(
                        session, project_id, gh_delivery_header, {"status": "duplicate"}
                    )
                raise

            logger.info(
                "github_webhook_scm_link_created",
                org_slug=org_slug,
                project_id=str(project_id),
                artifact_id=str(artifact.id),
                webhook_delivery_id=normalize_webhook_delivery_id(gh_delivery_header),
            )
            return await _github_json_record_delivery(session, project_id, gh_delivery_header, {"status": "created"})
    finally:
        set_current_tenant_id(prev_tenant)
