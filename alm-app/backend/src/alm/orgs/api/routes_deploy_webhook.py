"""Signed deploy webhook: records deployment_events without JWT (S4a)."""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Header, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse, Response

from alm.config.dependencies import ACTOR_ID_KEY, TENANT_ID_KEY
from alm.deployment.application.commands.create_deployment_event import CreateDeploymentEvent
from alm.orgs.api.scm_webhook_support import (
    SCM_WEBHOOK_MAX_BODY_BYTES,
    load_project_settings_for_webhook,
    load_tenant_id_for_slug,
    normalize_webhook_delivery_id,
    record_webhook_delivery_processed,
    webhook_delivery_already_processed,
)
from alm.project.api.public_settings import DEPLOY_WEBHOOK_SECRET_KEY
from alm.shared.application.mediator import Mediator
from alm.shared.domain.exceptions import ValidationError
from alm.shared.infrastructure.db.session import async_session_factory
from alm.shared.infrastructure.db.tenant_context import get_current_tenant_id, set_current_tenant_id

logger = structlog.get_logger()

router = APIRouter(tags=["SCM webhooks"])


def _signature_valid(secret: str, body: bytes, signature_header: str | None) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    expected = f"sha256={mac}"
    return hmac.compare_digest(expected, signature_header.lower())


class _DeployWebhookPayload(BaseModel):
    """JSON body for deploy webhook (same fields as manual POST minus source)."""

    environment: str = Field(..., min_length=1, max_length=64)
    occurred_at: str = Field(..., min_length=1, max_length=80)
    commit_sha: str | None = Field(None, max_length=64)
    image_digest: str | None = Field(None, max_length=512)
    repo_full_name: str | None = Field(None, max_length=512)
    artifact_keys: list[str] | None = Field(None, max_length=64)
    release_label: str | None = Field(None, max_length=256)
    build_id: str | None = Field(None, max_length=256)
    raw_context: dict[str, Any] | None = None
    idempotency_key: str | None = Field(None, max_length=128)


@router.post(
    "/projects/{project_id}/webhooks/deploy",
    summary="Signed deploy webhook (CI)",
    description=(
        "Verifies `X-Hub-Signature-256` (HMAC-SHA256) with `settings.deploy_webhook_secret`. "
        "JSON body matches deployment event fields; `source` is always stored as `ci_webhook`. "
        "Optional `X-ALM-Deploy-Delivery`: duplicate deliveries return `duplicate_delivery` after HTTP 200."
    ),
    responses={
        200: {"description": "created, duplicate idempotency, or duplicate_delivery"},
        400: {"description": "Invalid JSON"},
        401: {"description": "Missing or invalid signature"},
        404: {"description": "Unknown org/project or secret not configured"},
        413: {"description": "Body too large"},
        422: {"description": "Validation error"},
    },
)
async def deploy_webhook(
    org_slug: str,
    project_id: uuid.UUID,
    request: Request,
    x_hub_signature_256: Annotated[
        str | None,
        Header(
            alias="X-Hub-Signature-256",
            description="HMAC-SHA256 of the raw body, format `sha256=<hex>`.",
        ),
    ] = None,
    x_alm_deploy_delivery: Annotated[
        str | None,
        Header(
            alias="X-ALM-Deploy-Delivery",
            description="Optional unique delivery id for idempotent retries (max 128 chars).",
        ),
    ] = None,
) -> Response:
    body = await request.body()
    if len(body) > SCM_WEBHOOK_MAX_BODY_BYTES:
        logger.warning(
            "deploy_webhook_payload_too_large",
            org_slug=org_slug,
            project_id=str(project_id),
            body_bytes=len(body),
            limit=SCM_WEBHOOK_MAX_BODY_BYTES,
            webhook_delivery_id=normalize_webhook_delivery_id(x_alm_deploy_delivery),
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

            secret_raw = settings.get(DEPLOY_WEBHOOK_SECRET_KEY)
            if not isinstance(secret_raw, str) or not secret_raw.strip():
                return Response(status_code=404)

            secret = secret_raw.strip()
            if not _signature_valid(secret, body, x_hub_signature_256):
                logger.warning(
                    "deploy_webhook_bad_signature",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    webhook_delivery_id=normalize_webhook_delivery_id(x_alm_deploy_delivery),
                )
                return Response(status_code=401)

            try:
                raw: dict[str, Any] = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return Response(status_code=400)

            if raw.get("ping") is True:
                return JSONResponse({"status": "ok"})

            delivery = x_alm_deploy_delivery
            if delivery and await webhook_delivery_already_processed(session, project_id, "deploy", delivery):
                logger.info(
                    "deploy_webhook_duplicate_delivery",
                    org_slug=org_slug,
                    project_id=str(project_id),
                    webhook_delivery_id=normalize_webhook_delivery_id(delivery),
                )
                return JSONResponse({"status": "ignored", "reason": "duplicate_delivery"})

            try:
                parsed = _DeployWebhookPayload.model_validate(raw)
            except Exception as e:
                return JSONResponse({"detail": str(e)}, status_code=422)

            session.info[TENANT_ID_KEY] = tenant_id
            session.info[ACTOR_ID_KEY] = None
            mediator = Mediator(session)
            try:
                await mediator.send(
                    CreateDeploymentEvent(
                        tenant_id=tenant_id,
                        project_id=project_id,
                        environment=parsed.environment,
                        occurred_at=parsed.occurred_at,
                        commit_sha=parsed.commit_sha,
                        image_digest=parsed.image_digest,
                        repo_full_name=parsed.repo_full_name,
                        artifact_keys=parsed.artifact_keys,
                        release_label=parsed.release_label,
                        build_id=parsed.build_id,
                        source="ci_webhook",
                        raw_context=parsed.raw_context,
                        idempotency_key=parsed.idempotency_key,
                    )
                )
            except ValidationError as e:
                return JSONResponse({"detail": str(e)}, status_code=422)

            if delivery:
                await record_webhook_delivery_processed(session, project_id, "deploy", delivery)

            return JSONResponse({"status": "created"})
    finally:
        set_current_tenant_id(prev_tenant)
