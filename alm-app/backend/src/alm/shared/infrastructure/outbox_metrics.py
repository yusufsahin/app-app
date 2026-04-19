"""Prometheus metrics for the transactional domain-event outbox worker."""

from __future__ import annotations

from prometheus_client import Counter, Gauge

alm_domain_event_outbox_dispatched_total = Counter(
    "alm_domain_event_outbox_dispatched_total",
    "Outbox rows deleted after handlers succeeded (background worker)",
)

alm_domain_event_outbox_retry_scheduled_total = Counter(
    "alm_domain_event_outbox_retry_scheduled_total",
    "Handler failures recorded on an outbox row for later retry",
)

alm_domain_event_outbox_sync_cleared_total = Counter(
    "alm_domain_event_outbox_sync_cleared_total",
    "Outbox rows deleted immediately after successful post-commit dispatch (request path)",
)

alm_domain_event_outbox_dead_letter_requeued_total = Counter(
    "alm_domain_event_outbox_dead_letter_requeued_total",
    "Exhausted outbox rows reset for retry (admin requeue)",
)

alm_domain_event_outbox_pending_rows = Gauge(
    "alm_domain_event_outbox_pending_rows",
    "Rows currently stored in domain_event_outbox (updated after each worker batch)",
)

alm_domain_event_outbox_exhausted_rows = Gauge(
    "alm_domain_event_outbox_exhausted_rows",
    "Rows with attempts >= max_attempts (worker stops retrying; aligns with readiness exhausted count)",
)
