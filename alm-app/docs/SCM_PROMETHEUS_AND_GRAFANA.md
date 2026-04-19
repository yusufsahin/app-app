# SCM traceability — Prometheus metrics and Grafana

This note aligns with `docs/PLAN_SCM_TRACEABILITY.md` §7 and the counters implemented under `backend/src/alm/scm/infrastructure/metrics.py`.

## Exposed counters

| Metric | Labels | Meaning |
|--------|--------|---------|
| `alm_scm_links_created_total` | `source` | SCM rows created (manual, webhook, CI, etc.). |
| `alm_scm_webhook_unmatched_rows_persisted_total` | `provider`, `kind`, `reason` | Rows written to `scm_webhook_unmatched_events`. `reason` comes from `context.reason_code` when present, otherwise `unspecified`. |
| `alm_scm_webhook_push_commits_no_artifact_total` | `provider`, `reason` | Push commits processed where no artifact matched (may exceed unmatched row cap). Default `reason` is `artifact_not_found`. |

## Example PromQL

Rate of unmatched rows by provider and reason (5m window):

```promql
sum by (provider, reason) (rate(alm_scm_webhook_unmatched_rows_persisted_total[5m]))
```

Share of unmatched reasons for GitHub:

```promql
sum by (reason) (rate(alm_scm_webhook_unmatched_rows_persisted_total{provider="github"}[1h]))
```

## Grafana

1. Add your Prometheus data source pointing at the ALM `/metrics` endpoint (or the scrape target your platform uses).
2. Create a time-series panel with the first query above; legend `{{provider}} / {{reason}}`.
3. Optional: add a stat panel for `increase(alm_scm_links_created_total[24h])` split by `source` to see link volume.

Tune scrape interval and recording rules to match your cluster policy.

## Optional future: webhook dry-run preview

A dedicated admin-only `POST …/webhooks/{provider}/preview` could accept a raw payload and return `{ status, reason_code }` without persisting deliveries or SCM links. That endpoint is **not** implemented in the product yet; if added, it should redact secrets, cap body size like live webhooks, and require a strong permission (for example `project:update` on the target project plus an explicit feature flag).
