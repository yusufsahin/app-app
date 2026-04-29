"""Detect stale artifacts and emit AI insights."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from alm.ai.domain.entities import AiInsight
from alm.ai.domain.ports import IAiRepository
from alm.ai.domain.value_objects import InsightSeverity, InsightType
from alm.artifact.application.queries.list_artifacts import ListArtifacts
from alm.shared.application.mediator import Mediator


class StaleArtifactAnalyzer:
    def __init__(self, mediator: Mediator, ai_repo: IAiRepository) -> None:
        self._mediator = mediator
        self._ai_repo = ai_repo

    async def run(self, tenant_id: uuid.UUID, project_id: uuid.UUID) -> int:
        result = await self._mediator.query(
            ListArtifacts(
                tenant_id=tenant_id,
                project_id=project_id,
                limit=500,
                include_deleted=False,
            )
        )
        threshold = datetime.now(UTC) - timedelta(days=14)
        stale = [a for a in result.items if a.updated_at and a.updated_at < threshold]
        for artifact in stale[:50]:
            await self._ai_repo.save_insight(
                AiInsight.create(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    insight_type=InsightType.STALE_ARTIFACT,
                    severity=InsightSeverity.WARNING,
                    title=f"Stale artifact: {artifact.artifact_key}",
                    body=f"Artifact '{artifact.title}' has not been updated for 14+ days.",
                    context={"artifact_id": str(artifact.id)},
                )
            )
        return len(stale)
