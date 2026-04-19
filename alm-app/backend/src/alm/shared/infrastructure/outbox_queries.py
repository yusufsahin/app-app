"""Shared SQL for ``domain_event_outbox`` aggregate counts (readiness + Prometheus)."""

OUTBOX_AGGREGATE_ROW_COUNTS_SQL = """
SELECT
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE attempts >= :max_attempts)::bigint AS exhausted
FROM domain_event_outbox
"""

REQUEUE_EXHAUSTED_OUTBOX_ROWS_SQL = """
WITH picked AS (
  SELECT id FROM domain_event_outbox
  WHERE attempts >= :max_attempts
  ORDER BY created_at ASC
  LIMIT :requeue_limit
)
UPDATE domain_event_outbox AS o
SET
  attempts = 0,
  locked_until = NULL,
  next_attempt_at = NULL,
  last_error = NULL
FROM picked
WHERE o.id = picked.id
RETURNING o.id
"""
