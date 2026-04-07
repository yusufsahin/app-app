"""Shared helpers for SCM provider webhooks (tenant/project bootstrap, artifact match)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from alm.artifact.domain.entities import Artifact
from alm.artifact.infrastructure.repositories import SqlAlchemyArtifactRepository
from alm.project.infrastructure.models import ProjectModel
from alm.scm.application.artifact_key_hints import extract_artifact_key_hints
from alm.scm.application.task_ref_trailers import iter_task_uuids_from_refs_trailers
from alm.scm.infrastructure.metrics import (
    alm_scm_webhook_push_commits_no_artifact_total,
    alm_scm_webhook_unmatched_rows_persisted_total,
)
from alm.scm.infrastructure.models import ScmWebhookProcessedDeliveryModel, ScmWebhookUnmatchedEventModel
from alm.task.infrastructure.repositories import SqlAlchemyTaskRepository
from alm.tenant.infrastructure.models import TenantModel

SCM_GITHUB_WEBHOOK_SECRET_KEY = "scm_github_webhook_secret"
SCM_GITLAB_WEBHOOK_SECRET_KEY = "scm_gitlab_webhook_secret"

# Reject oversized payloads before JSON parse (metadata-only webhooks; tune via reverse proxy if needed).
SCM_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024

# Cap commits processed per push webhook (large merges / mirror pushes).
SCM_WEBHOOK_MAX_PUSH_COMMITS = 32

# Cap persisted unmatched rows per webhook delivery (avoid flooding on huge pushes).
SCM_WEBHOOK_MAX_UNMATCHED_RECORDS_PER_REQUEST = 20

# GitHub X-GitHub-Delivery / GitLab X-Gitlab-Event-UUID (enterprise idempotency).
SCM_WEBHOOK_MAX_DELIVERY_ID_LEN = 128


def normalize_webhook_delivery_id(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s or len(s) > SCM_WEBHOOK_MAX_DELIVERY_ID_LEN:
        return None
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in s):
        return None
    return s


async def webhook_delivery_already_processed(
    session: AsyncSession,
    project_id: uuid.UUID,
    provider: str,
    delivery_id: str | None,
) -> bool:
    did = normalize_webhook_delivery_id(delivery_id)
    if did is None:
        return False
    pv = provider.strip().lower()[:16]
    q = select(
        exists().where(
            ScmWebhookProcessedDeliveryModel.project_id == project_id,
            ScmWebhookProcessedDeliveryModel.provider == pv,
            ScmWebhookProcessedDeliveryModel.delivery_id == did,
        )
    )
    r = await session.execute(q)
    return bool(r.scalar())


async def record_webhook_delivery_processed(
    session: AsyncSession,
    project_id: uuid.UUID,
    provider: str,
    delivery_id: str | None,
) -> None:
    """Persist delivery id after a terminal 200 outcome (separate commit; safe after Mediator.commit)."""
    did = normalize_webhook_delivery_id(delivery_id)
    if did is None:
        return
    pv = provider.strip().lower()[:16]
    session.add(
        ScmWebhookProcessedDeliveryModel(
            id=uuid.uuid4(),
            project_id=project_id,
            provider=pv,
            delivery_id=did,
        )
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()


def sanitize_unmatched_context(raw: dict[str, Any], *, max_str: int = 500) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in raw.items():
        if isinstance(v, str):
            out[k] = v[:max_str]
        elif isinstance(v, (int, bool)) or v is None:
            out[k] = v
        elif isinstance(v, list):
            out[k] = [x[:max_str] if isinstance(x, str) else x for x in v[:20]]
        else:
            out[k] = str(v)[:max_str]
    return out


async def persist_webhook_unmatched_events(
    session: AsyncSession,
    project_id: uuid.UUID,
    provider: str,
    kind: str,
    contexts: list[dict[str, Any]],
) -> None:
    pv = provider[:32]
    kd = kind[:64]
    for ctx in contexts[:SCM_WEBHOOK_MAX_UNMATCHED_RECORDS_PER_REQUEST]:
        session.add(
            ScmWebhookUnmatchedEventModel(
                project_id=project_id,
                provider=pv,
                kind=kd,
                context=sanitize_unmatched_context(ctx),
            )
        )
        alm_scm_webhook_unmatched_rows_persisted_total.labels(provider=pv, kind=kd).inc()
    await session.flush()


def record_push_commit_no_artifact_match(*, provider: str) -> None:
    """Count push commits where artifact_for_pr_fields returned no artifact."""
    alm_scm_webhook_push_commits_no_artifact_total.labels(provider=provider.strip().lower()[:16]).inc()


def branch_short_name_from_ref(ref: str | None) -> str | None:
    """Return branch name for refs/heads/* only (ignore tags and other refs)."""
    if not ref or not isinstance(ref, str):
        return None
    prefix = "refs/heads/"
    if not ref.startswith(prefix):
        return None
    name = ref[len(prefix) :].strip()
    return name or None


async def load_tenant_id_for_slug(session: AsyncSession, org_slug: str) -> uuid.UUID | None:
    r = await session.execute(
        select(TenantModel.id).where(
            TenantModel.slug == org_slug,
            TenantModel.deleted_at.is_(None),
        )
    )
    return r.scalar_one_or_none()


async def load_project_settings_for_webhook(
    session: AsyncSession,
    project_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict | None:
    """Return merged settings dict if the project row exists; None if no such project."""
    result = await session.execute(
        select(ProjectModel.settings).where(
            ProjectModel.id == project_id,
            ProjectModel.tenant_id == tenant_id,
            ProjectModel.deleted_at.is_(None),
        )
    )
    row = result.first()
    if row is None:
        return None
    raw = row[0]
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        return {}
    return raw


async def resolve_task_id_from_refs_trailers_for_artifact(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    artifact_id: uuid.UUID,
    combined_text: str,
) -> uuid.UUID | None:
    """If text contains `Refs:` or `Task-ID:` git trailers with UUIDs, return first that matches a task on this artifact."""
    repo = SqlAlchemyTaskRepository(session)
    for uid in iter_task_uuids_from_refs_trailers(combined_text):
        task = await repo.find_by_id(uid)
        if task is not None and task.project_id == project_id and task.artifact_id == artifact_id:
            return uid
    return None


async def artifact_for_pr_fields(
    *,
    project_id: uuid.UUID,
    head_ref: str,
    title: str,
    body_text: str,
    artifact_repo: SqlAlchemyArtifactRepository,
) -> Artifact | None:
    """Resolve artifact: branch → title → body; first hint that matches an artifact wins.

    Push handlers pass the **full** commit message as ``title`` so subject, body, and footers
    (e.g. ``Story:``) participate in the same order as §4 Faz S3 (branch name, then message text).
    """
    for part in (head_ref, title, body_text):
        if not (part or "").strip():
            continue
        hints = extract_artifact_key_hints(part)
        if not hints:
            continue
        found = await artifact_repo.list_by_project_and_artifact_keys(project_id, tuple(hints))
        by_upper = {a.artifact_key.upper(): a for a in found if a.artifact_key}
        for h in hints:
            art = by_upper.get(h.strip().upper())
            if art is not None:
                return art
    return None
