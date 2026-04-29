"""AI metrics helpers."""

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Iterator

from prometheus_client import Counter, Histogram

AI_REQUESTS_TOTAL = Counter(
    "alm_ai_requests_total",
    "Total AI requests",
    ["route", "provider", "status"],
)
AI_REQUEST_LATENCY_SECONDS = Histogram(
    "alm_ai_request_latency_seconds",
    "Latency of AI requests",
    ["route", "provider"],
)
AI_TOOL_CALLS_TOTAL = Counter(
    "alm_ai_tool_calls_total",
    "Total AI tool calls",
    ["tool_name", "status"],
)


@contextmanager
def track_ai_request(route: str, provider: str) -> Iterator[None]:
    start = time.perf_counter()
    status = "ok"
    try:
        yield
    except Exception:
        status = "error"
        raise
    finally:
        elapsed = time.perf_counter() - start
        AI_REQUESTS_TOTAL.labels(route=route, provider=provider, status=status).inc()
        AI_REQUEST_LATENCY_SECONDS.labels(route=route, provider=provider).observe(elapsed)
