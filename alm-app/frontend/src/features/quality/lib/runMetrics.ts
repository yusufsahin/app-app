import type { StepResult, TestStep } from "../types";

export const RUN_METRICS_VERSION = 2 as const;

export type ConfigurationSnapshot = {
  id: string;
  name?: string;
  label?: string;
  values: Record<string, string>;
  isDefault?: boolean;
  status?: "active" | "draft" | "archived";
  tags?: string[];
};

export type TestExecutionResultRow = {
  testId: string;
  status: "passed" | "failed" | "blocked" | "not-executed";
  stepResults: StepResult[];
  /** Flattened steps at save time (Call-to-Test expanded) for historical accuracy. */
  expandedStepsSnapshot?: TestStep[];
  /** Stable configuration identity selected for this execution. */
  configurationId?: string | null;
  configurationName?: string | null;
  configurationSnapshot?: ConfigurationSnapshot | null;
  /** Final merged map used for ${} substitution at save time. */
  resolvedValues?: Record<string, string>;
  /** Deprecated read-compat fields. */
  paramRowIndex?: number | null;
  paramValuesUsed?: Record<string, string>;
};

export interface RunMetricsDocumentV2 {
  v: typeof RUN_METRICS_VERSION;
  results: TestExecutionResultRow[];
}

function normalizeRow(row: TestExecutionResultRow): TestExecutionResultRow {
  return {
    ...row,
    stepResults: Array.isArray(row.stepResults)
      ? row.stepResults.map((step) => ({
          ...step,
          linkedDefectIds: Array.isArray(step.linkedDefectIds)
            ? step.linkedDefectIds.filter((id): id is string => typeof id === "string" && id.length > 0)
            : undefined,
          attachmentIds: Array.isArray(step.attachmentIds)
            ? step.attachmentIds.filter((id): id is string => typeof id === "string" && id.length > 0)
            : undefined,
          attachmentNames: Array.isArray(step.attachmentNames)
            ? step.attachmentNames.filter((name): name is string => typeof name === "string" && name.length > 0)
            : undefined,
          lastEvidenceAt: typeof step.lastEvidenceAt === "string" ? step.lastEvidenceAt : null,
          expectedResultSnapshot:
            typeof step.expectedResultSnapshot === "string" ? step.expectedResultSnapshot : undefined,
          stepNameSnapshot: typeof step.stepNameSnapshot === "string" ? step.stepNameSnapshot : undefined,
          stepNumber: typeof step.stepNumber === "number" ? step.stepNumber : undefined,
        }))
      : [],
    configurationId: row.configurationId ?? null,
    configurationName: row.configurationName ?? row.configurationSnapshot?.name ?? row.configurationSnapshot?.label ?? null,
    configurationSnapshot: row.configurationSnapshot ?? null,
    resolvedValues: row.resolvedValues ?? row.paramValuesUsed ?? undefined,
    paramValuesUsed: row.paramValuesUsed ?? row.resolvedValues ?? undefined,
    paramRowIndex: row.paramRowIndex ?? null,
  };
}

export function parseRunMetricsPayload(raw: unknown): TestExecutionResultRow[] | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const doc = parsed as Record<string, unknown>;
  const results = doc.results;
  if (!Array.isArray(results)) return null;
  if (doc.v === 1 || doc.v === RUN_METRICS_VERSION) {
    return (results as TestExecutionResultRow[]).map(normalizeRow);
  }
  return null;
}

export function stringifyRunMetricsPayload(results: TestExecutionResultRow[]): string {
  return JSON.stringify({
    v: RUN_METRICS_VERSION,
    results: results.map((row) => ({
      ...row,
      resolvedValues: row.resolvedValues ?? row.paramValuesUsed,
      configurationId: row.configurationId ?? null,
      configurationName: row.configurationName ?? null,
      configurationSnapshot: row.configurationSnapshot ?? null,
    })),
  } satisfies RunMetricsDocumentV2);
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

/** Display value for manifest `environment` / `target_environment` on test-run (and similar) rows. */
export function formatRunEnvironmentLabel(customFields: Record<string, unknown> | undefined): string {
  if (!customFields) return "—";
  const pick = (k: string) => {
    const v = customFields[k];
    if (v == null) return "";
    const s = String(v).trim();
    return s;
  };
  const env =
    pick("environment") || pick("Environment") || pick("target_environment");
  return env || "—";
}
