"""Prometheus metrics for SCM traceability (§7 PLAN_SCM_TRACEABILITY)."""

from __future__ import annotations

from prometheus_client import Counter

alm_scm_links_created_total = Counter(
    "alm_scm_links_created_total",
    "SCM links persisted (manual, webhook, or ci)",
    ["source"],
)

alm_scm_webhook_unmatched_rows_persisted_total = Counter(
    "alm_scm_webhook_unmatched_rows_persisted_total",
    "Rows inserted into scm_webhook_unmatched_events after a no_match outcome",
    ["provider", "kind", "reason"],
)

alm_scm_webhook_push_commits_no_artifact_total = Counter(
    "alm_scm_webhook_push_commits_no_artifact_total",
    "Push webhook commits that did not resolve an artifact (can exceed unmatched row cap)",
    ["provider", "reason"],
)
