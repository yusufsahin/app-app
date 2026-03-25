# Quality — API notes (gap analysis)

## List + filter

- `GET /orgs/{org}/projects/{id}/artifacts` supports `tree=quality` and `type={artifact_type}` together (same as Artifacts page).
- Pagination: `limit`, `offset`.
- Full-text style filter: query param `q` (passed through `buildArtifactListParams` / `useArtifacts`).

No dedicated Quality aggregate endpoint; hub totals use `limit=1` and the response `total` field.

## Links

- Create/delete uses existing artifact link endpoints; link type strings must exist in manifest (`suite_includes_test`, `run_for_suite`, `campaign_includes_suite` for the extended Quality domain).
- Bulk “campaign wizard” APIs are not implemented; multiple links are created per artifact in the UI.

## Backfill

Runtime reads merge [`merge_manifest_metadata_defaults`](../backend/src/alm/artifact/domain/manifest_merge_defaults.py), which applies [`merge_quality_domain_into_defs`](../backend/src/alm/artifact/domain/quality_manifest_extension.py) **idempotently** (skips if `test-suite` is already in `defs`). Stored DB rows are unchanged; API/UI see the merged view.

New built-in template rows from [`seed.py`](../backend/src/alm/config/seed.py) use [`with_quality_manifest_bundle`](../backend/src/alm/artifact/domain/quality_manifest_extension.py) at seed time.
