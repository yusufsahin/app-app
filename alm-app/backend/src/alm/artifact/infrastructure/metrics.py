"""Artifact transition metrics for Prometheus."""
from __future__ import annotations

import time
from prometheus_client import Counter, Histogram

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
