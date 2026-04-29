"""Background scheduler facade for AI analyzers."""

from __future__ import annotations

import uuid

from alm.ai.application.background.coverage_gap_analyzer import CoverageGapAnalyzer
from alm.ai.application.background.duplicate_detector import DuplicateDetector
from alm.ai.application.background.stale_artifact_analyzer import StaleArtifactAnalyzer


class AiInsightsScheduler:
    def __init__(
        self,
        stale_analyzer: StaleArtifactAnalyzer,
        coverage_analyzer: CoverageGapAnalyzer,
        duplicate_detector: DuplicateDetector,
    ) -> None:
        self._stale_analyzer = stale_analyzer
        self._coverage_analyzer = coverage_analyzer
        self._duplicate_detector = duplicate_detector

    async def run_for_project(self, tenant_id: uuid.UUID, project_id: uuid.UUID) -> dict[str, int]:
        stale_count = await self._stale_analyzer.run(tenant_id, project_id)
        coverage_count = await self._coverage_analyzer.run(tenant_id, project_id)
        duplicate_count = await self._duplicate_detector.run(tenant_id, project_id)
        return {
            "stale_artifact": stale_count,
            "coverage_gap": coverage_count,
            "duplicate": duplicate_count,
        }
