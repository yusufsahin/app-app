import type { StepResult, TestStep } from "../types";

export const RUN_METRICS_VERSION = 1 as const;

export type TestExecutionResultRow = {
  testId: string;
  status: "passed" | "failed" | "blocked" | "not-executed";
  stepResults: StepResult[];
  /** Flattened steps at save time (Call-to-Test expanded) for historical accuracy. */
  expandedStepsSnapshot?: TestStep[];
  /** Selected dataset row index when `test_params_json.rows` exists; null = defaults only. */
  paramRowIndex?: number | null;
  /** Final merged map (caller row + callee defaults) used for ${} substitution at save time. */
  paramValuesUsed?: Record<string, string>;
};

export interface RunMetricsDocumentV1 {
  v: typeof RUN_METRICS_VERSION;
  results: TestExecutionResultRow[];
}

/** Parse legacy array, v1 `{ results }`, or `{ testResults: Record<...> }` shapes. */
export function parseRunMetricsPayload(raw: unknown): TestExecutionResultRow[] | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) {
    return parsed as TestExecutionResultRow[];
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as RunMetricsDocumentV1).results)) {
    return (parsed as RunMetricsDocumentV1).results;
  }
  const tr = (parsed as { testResults?: Record<string, { stepResults?: StepResult[]; status?: string }> })
    .testResults;
  if (tr && typeof tr === "object") {
    const entries = Object.entries(tr);
    if (entries.length === 0) return [];
    return entries.map(([testId, v]) => ({
      testId,
      status: (v.status as TestExecutionResultRow["status"]) || "not-executed",
      stepResults: Array.isArray(v.stepResults) ? v.stepResults : [],
    }));
  }
  return null;
}

export function stringifyRunMetricsPayload(results: TestExecutionResultRow[]): string {
  return JSON.stringify({ v: RUN_METRICS_VERSION, results } satisfies RunMetricsDocumentV1);
}

export type RunMetricsSummary = {
  passed: number;
  failed: number;
  blocked: number;
  notExecuted: number;
  total: number;
};

/** Count result statuses for table summaries and badges. */
export function summarizeRunMetrics(results: TestExecutionResultRow[] | null | undefined): RunMetricsSummary {
  const empty: RunMetricsSummary = { passed: 0, failed: 0, blocked: 0, notExecuted: 0, total: 0 };
  if (!results?.length) return empty;
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let notExecuted = 0;
  for (const r of results) {
    switch (r.status) {
      case "passed":
        passed += 1;
        break;
      case "failed":
        failed += 1;
        break;
      case "blocked":
        blocked += 1;
        break;
      default:
        notExecuted += 1;
        break;
    }
  }
  return { passed, failed, blocked, notExecuted, total: results.length };
}

export function summarizeRunMetricsFromCustomFields(customFields: Record<string, unknown> | undefined): RunMetricsSummary {
  return summarizeRunMetrics(parseRunMetricsPayload(customFields?.run_metrics_json));
}
