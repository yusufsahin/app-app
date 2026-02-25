"""Artifact transition metrics for Prometheus — implements domain port IArtifactTransitionMetrics."""

from __future__ import annotations

from prometheus_client import Counter, Histogram

from alm.artifact.domain.ports import IArtifactTransitionMetrics

alm_artifact_transition_total = Counter(
    "alm_artifact_transition_total",
    "Total artifact workflow transitions by result",
    ["result"],
)

alm_artifact_transition_duration_seconds = Histogram(
    "alm_artifact_transition_duration_seconds",
    "Duration of artifact transition handling in seconds",
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
)


class PrometheusArtifactTransitionMetrics(IArtifactTransitionMetrics):
    """Infrastructure implementation of artifact transition metrics."""

    def record_duration_seconds(self, duration: float) -> None:
        alm_artifact_transition_duration_seconds.observe(duration)

    def record_result(self, result: str) -> None:
        alm_artifact_transition_total.labels(result=result).inc()
