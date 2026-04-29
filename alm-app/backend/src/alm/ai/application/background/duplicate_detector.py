"""Naive duplicate detector placeholder (title similarity)."""

from __future__ import annotations

import uuid

from alm.ai.domain.entities import AiInsight
from alm.ai.domain.ports import IAiRepository
from alm.ai.domain.value_objects import InsightSeverity, InsightType
from alm.artifact.application.queries.list_artifacts import ListArtifacts
from alm.shared.application.mediator import Mediator


class DuplicateDetector:
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
        seen: dict[str, str] = {}
        duplicates = 0
        for artifact in result.items:
            key = artifact.title.strip().lower()
            if not key:
                continue
            first = seen.get(key)
            if first is None:
                seen[key] = str(artifact.id)
                continue
            duplicates += 1
            await self._ai_repo.save_insight(
                AiInsight.create(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    insight_type=InsightType.DUPLICATE,
                    severity=InsightSeverity.INFO,
                    title=f"Potential duplicate: {artifact.artifact_key}",
                    body="Potential duplicate title detected.",
                    context={"artifact_id": str(artifact.id), "duplicate_of": first},
                )
            )
        return duplicates
