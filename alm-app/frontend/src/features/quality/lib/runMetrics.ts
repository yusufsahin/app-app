import type { StepResult } from "../types";

export const RUN_METRICS_VERSION = 1 as const;

export type TestExecutionResultRow = {
  testId: string;
  status: "passed" | "failed" | "blocked" | "not-executed";
  stepResults: StepResult[];
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
