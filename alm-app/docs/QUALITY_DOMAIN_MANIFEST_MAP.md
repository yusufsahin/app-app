# Quality domain — prototype → manifest mapping

Maps concepts from [Metadatadriventestmanagement](../../Metadatadriventestmanagement/) to ALM **artifacts** under separate `tests` and `testsuites` roots.

## Decisions

| Topic | Choice |
|-------|--------|
| Trees | Two trees: **`tests`** (`root-tests`) and **`testsuites`** (`root-testsuites`). |
| Folders | **`test-folder`** for test-cases, **`testsuite-folder`** for suites/runs/campaigns. |
| Suite ↔ test membership | **`suite_includes_test`** link: `from` = `test-suite`, `to` = `test-case`. |
| Run ↔ suite | **`run_for_suite`** link: `from` = `test-run`, `to` = `test-suite`. |
| Campaign ↔ suite | **`campaign_includes_suite`** link: `from` = `test-campaign`, `to` = `test-suite`. |
| Test steps | **`test_steps_json`** on `test-case`: JSON array of rows. **Inline step:** `kind: "step"` (optional for legacy), `id`, `name` / `action`, `description`, `expectedResult`, … **Call to test (reuse):** `kind: "call"`, `id`, `calledTestCaseId`, optional `calledTitle`, optional **`paramOverrides`** (object: string values) merged into execution param map (preorder); root dataset still wins on key clash. |
| Test parameters | **`test_params_json`**: `{ defs: [{ name, label?, default? }], rows?: [{ label?, values: Record<string,string> }] }` for `${name}` substitution in step text during manual runs. |
| Run/campaign structured extras | **`run_metrics_json`** (`v` + `results`): each result may include **`expandedStepsSnapshot`** (flattened steps after resolving calls and parameter substitution), optional **`paramRowIndex`** / **`paramValuesUsed`**. **`campaign_config_json`** string field (JSON). |
| Workflows | **`quality_run`**, **`quality_campaign`** for run/campaign states; suite uses the same workflow as `test-case` per template (`basic`, `scrum`, `kanban`, `ado_basic`). |

## Artifact types (built-in templates)

| `artifact_type` | Role |
|-----------------|------|
| `test-folder` | Container for `test-case` hierarchy. |
| `testsuite-folder` | Container for `test-suite`, `test-run`, `test-campaign`. |
| `test-case` | Executable test; steps in `test_steps_json`. |
| `test-suite` | Groups tests via links. |
| `test-run` | Execution of a suite; metrics JSON optional. |
| `test-campaign` | Groups suite runs / planning; config JSON optional. |

## Link types

| `link_type` | Direction |
|-------------|-----------|
| `suite_includes_test` | test-suite → test-case |
| `run_for_suite` | test-run → test-suite |
| `campaign_includes_suite` | test-campaign → test-suite |

Existing quality links (`verifies`, etc.) unchanged.

## Implementation

- Manifest injection: [`quality_manifest_extension.py`](../backend/src/alm/artifact/domain/quality_manifest_extension.py) — `with_quality_manifest_bundle` (seed) and `merge_quality_domain_into_defs` ([`manifest_merge_defaults.py`](../backend/src/alm/artifact/domain/manifest_merge_defaults.py) at runtime, idempotent).
- UI: Quality hub + `/quality/tests`, `/quality/suites`, `/quality/runs`, `/quality/campaigns` filter `ArtifactsPage` by `type` query.
- Demo data: first seeded project includes a demo suite, run, campaign and the links above.

See also [QUALITY_SUITE.md](./QUALITY_SUITE.md).
