"""Org API: list and triage SCM webhook deliveries that did not match an artifact."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from alm.orgs.api._router_deps import (
    CurrentUser,
    ResolvedOrg,
    require_permission,
    resolve_org,
)
from alm.project.infrastructure.models import ProjectModel
from alm.scm.api.schemas import ScmWebhookUnmatchedEventResponse
from alm.scm.infrastructure.models import ScmWebhookUnmatchedEventModel
from alm.shared.domain.exceptions import EntityNotFound
from alm.shared.infrastructure.db.session import async_session_factory
from alm.shared.infrastructure.db.tenant_context import get_current_tenant_id, set_current_tenant_id

router = APIRouter(tags=["SCM webhooks"])

UnmatchedTriageFilter = Literal["open", "dismissed", "all"]


def _unmatched_event_to_response(m: ScmWebhookUnmatchedEventModel) -> ScmWebhookUnmatchedEventResponse:
    return ScmWebhookUnmatchedEventResponse(
        id=m.id,
        project_id=m.project_id,
        provider=m.provider,
        kind=m.kind,
        context=dict(m.context),
        created_at=m.created_at.isoformat() if m.created_at else "",
        dismissed_at=m.dismissed_at.isoformat() if m.dismissed_at else None,
        dismissed_by=m.dismissed_by,
    )


async def _ensure_project_in_org(session: AsyncSession, *, project_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
    pr = await session.execute(
        select(ProjectModel.id).where(
            ProjectModel.id == project_id,
            ProjectModel.tenant_id == tenant_id,
            ProjectModel.deleted_at.is_(None),
        )
    )
    if pr.scalar_one_or_none() is None:
        raise EntityNotFound("Project", project_id)


@router.get(
    "/projects/{project_id}/webhooks/unmatched-events",
    response_model=list[ScmWebhookUnmatchedEventResponse],
    summary="List unmatched SCM webhook deliveries",
)
async def list_scm_webhook_unmatched_events(
    project_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    triage: UnmatchedTriageFilter = Query("open", description="open | dismissed | all"),
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("project:read"),
) -> list[ScmWebhookUnmatchedEventResponse]:
    prev = get_current_tenant_id()
    try:
        set_current_tenant_id(org.tenant_id)
        async with async_session_factory() as session:
            await session.rollback()
            await _ensure_project_in_org(session, project_id=project_id, tenant_id=org.tenant_id)

            q = select(ScmWebhookUnmatchedEventModel).where(
                ScmWebhookUnmatchedEventModel.project_id == project_id,
            )
            if triage == "open":
                q = q.where(ScmWebhookUnmatchedEventModel.dismissed_at.is_(None))
            elif triage == "dismissed":
                q = q.where(ScmWebhookUnmatchedEventModel.dismissed_at.is_not(None))

            q = q.order_by(desc(ScmWebhookUnmatchedEventModel.created_at)).limit(limit).offset(offset)
            result = await session.execute(q)
            rows = result.scalars().all()
            return [_unmatched_event_to_response(m) for m in rows]
    finally:
        set_current_tenant_id(prev)


@router.post(
    "/projects/{project_id}/webhooks/unmatched-events/{event_id}/dismiss",
    response_model=ScmWebhookUnmatchedEventResponse,
    summary="Dismiss unmatched webhook event",
)
async def dismiss_scm_webhook_unmatched_event(
    project_id: uuid.UUID,
    event_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    user: CurrentUser = require_permission("project:update"),
) -> ScmWebhookUnmatchedEventResponse:
    prev = get_current_tenant_id()
    try:
        set_current_tenant_id(org.tenant_id)
        async with async_session_factory() as session:
            await session.rollback()
            await _ensure_project_in_org(session, project_id=project_id, tenant_id=org.tenant_id)

            row = await session.get(ScmWebhookUnmatchedEventModel, event_id)
            if row is None or row.project_id != project_id:
                raise EntityNotFound("ScmWebhookUnmatchedEvent", event_id)

            now = datetime.now(UTC)
            if row.dismissed_at is None:
                row.dismissed_at = now
                row.dismissed_by = user.id
                await session.commit()
                await session.refresh(row)
            return _unmatched_event_to_response(row)
    finally:
        set_current_tenant_id(prev)


@router.post(
    "/projects/{project_id}/webhooks/unmatched-events/{event_id}/undismiss",
    response_model=ScmWebhookUnmatchedEventResponse,
    summary="Restore dismissed unmatched webhook event",
)
async def undismiss_scm_webhook_unmatched_event(
    project_id: uuid.UUID,
    event_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("project:update"),
) -> ScmWebhookUnmatchedEventResponse:
    prev = get_current_tenant_id()
    try:
        set_current_tenant_id(org.tenant_id)
        async with async_session_factory() as session:
            await session.rollback()
            await _ensure_project_in_org(session, project_id=project_id, tenant_id=org.tenant_id)

            row = await session.get(ScmWebhookUnmatchedEventModel, event_id)
            if row is None or row.project_id != project_id:
                raise EntityNotFound("ScmWebhookUnmatchedEvent", event_id)

            if row.dismissed_at is not None:
                row.dismissed_at = None
                row.dismissed_by = None
                await session.commit()
                await session.refresh(row)
            return _unmatched_event_to_response(row)
    finally:
        set_current_tenant_id(prev)
