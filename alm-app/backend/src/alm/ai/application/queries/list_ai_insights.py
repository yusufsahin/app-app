"""List AI insights for a project."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from alm.ai.domain.ports import IAiRepository
from alm.shared.application.query import Query, QueryHandler


@dataclass
class AiInsightDTO:
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    insight_type: str
    severity: str
    title: str
    body: str
    context: dict[str, Any]
    is_dismissed: bool
    created_at: datetime | None


@dataclass(frozen=True)
class ListAiInsights(Query):
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    include_dismissed: bool = False


class ListAiInsightsHandler(QueryHandler[list[AiInsightDTO]]):
    def __init__(self, repo: IAiRepository) -> None:
        self._repo = repo

    async def handle(self, query: Query) -> list[AiInsightDTO]:
        assert isinstance(query, ListAiInsights)
        insights = await self._repo.list_insights(
            tenant_id=query.tenant_id,
            project_id=query.project_id,
            include_dismissed=query.include_dismissed,
        )
        return [
            AiInsightDTO(
                id=i.id,
                tenant_id=i.tenant_id,
                project_id=i.project_id,
                insight_type=i.insight_type.value,
                severity=i.severity.value,
                title=i.title,
                body=i.body,
                context=i.context,
                is_dismissed=i.is_dismissed,
                created_at=i.created_at,
            )
            for i in insights
        ]
