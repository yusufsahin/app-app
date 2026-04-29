"""Detect coverage gaps and emit AI insights."""

from __future__ import annotations

import uuid

from alm.ai.domain.entities import AiInsight
from alm.ai.domain.ports import IAiRepository
from alm.ai.domain.value_objects import InsightSeverity, InsightType
from alm.quality.application.queries.requirement_coverage_analysis import RequirementCoverageAnalysis
from alm.shared.application.mediator import Mediator


class CoverageGapAnalyzer:
    def __init__(self, mediator: Mediator, ai_repo: IAiRepository) -> None:
        self._mediator = mediator
        self._ai_repo = ai_repo

    async def run(self, tenant_id: uuid.UUID, project_id: uuid.UUID) -> int:
        report = await self._mediator.query(
            RequirementCoverageAnalysis(
                tenant_id=tenant_id,
                project_id=project_id,
            )
        )
        uncovered = [r for r in report.rows if not r.has_test_case]
        for row in uncovered[:50]:
            await self._ai_repo.save_insight(
                AiInsight.create(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    insight_type=InsightType.COVERAGE_GAP,
                    severity=InsightSeverity.WARNING,
                    title=f"Coverage gap: {row.requirement_key}",
                    body="Requirement has no linked test case.",
                    context={"requirement_id": str(row.requirement_id)},
                )
            )
        return len(uncovered)
