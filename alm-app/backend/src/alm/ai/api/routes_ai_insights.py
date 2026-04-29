"""AI insights routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from alm.ai.api.schemas import InsightResponse
from alm.ai.application.queries.list_ai_insights import ListAiInsights
from alm.ai.infrastructure.repositories import SqlAlchemyAiRepository
from alm.config.dependencies import get_db, get_mediator
from alm.shared.application.mediator import Mediator
from alm.shared.api.schemas import MessageResponse
from alm.shared.infrastructure.org_resolver import ResolvedOrg, resolve_org
from alm.shared.infrastructure.security.dependencies import CurrentUser, require_permission

router = APIRouter()


@router.get("/projects/{project_id}/ai/insights", response_model=list[InsightResponse])
async def list_insights(
    project_id: uuid.UUID,
    include_dismissed: bool = False,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("artifact:read"),
    mediator: Mediator = Depends(get_mediator),
) -> list[InsightResponse]:
    rows = await mediator.query(
        ListAiInsights(
            tenant_id=org.tenant_id,
            project_id=project_id,
            include_dismissed=include_dismissed,
        )
    )
    return [
        InsightResponse(
            id=r.id,
            tenant_id=r.tenant_id,
            project_id=r.project_id,
            insight_type=r.insight_type,
            severity=r.severity,
            title=r.title,
            body=r.body,
            context=r.context,
            is_dismissed=r.is_dismissed,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/projects/{project_id}/ai/insights/{insight_id}/dismiss", response_model=MessageResponse)
async def dismiss_insight(
    project_id: uuid.UUID,
    insight_id: uuid.UUID,
    org: ResolvedOrg = Depends(resolve_org),
    _user: CurrentUser = require_permission("artifact:update"),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    _ = project_id
    repo = SqlAlchemyAiRepository(db)
    insight = await repo.list_insights(org.tenant_id, project_id, include_dismissed=True)
    if any(i.id == insight_id for i in insight):
        await repo.dismiss_insight(insight_id)
    return MessageResponse(message="Insight dismissed")
