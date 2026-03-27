import type { TestPlanEntry, TestStep } from "../types";
import { isTestPlanCall } from "../types";

export const DEFAULT_EXPAND_MAX_DEPTH = 10;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseParamOverridesField(raw: unknown): Record<string, string> | undefined {
  const o = asObject(raw);
  if (!o) return undefined;
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") m[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") m[k] = String(v);
    else if (v != null) m[k] = String(v);
  }
  return Object.keys(m).length > 0 ? m : undefined;
}

/** Parse persisted test_steps_json into plan entries (inline + call rows). */
export function parseTestPlan(raw: unknown): TestPlanEntry[] {
  let items = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      items = JSON.parse(raw);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) return [];

  const parsed: TestPlanEntry[] = [];
  for (const item of items) {
    const obj = asObject(item);
    if (!obj) continue;

    const kindRaw = obj.kind;
    if (kindRaw === "call") {
      const calledTestCaseId =
        typeof obj.calledTestCaseId === "string"
          ? obj.calledTestCaseId
          : typeof obj.called_test_case_id === "string"
            ? obj.called_test_case_id
            : "";
      if (!calledTestCaseId.trim()) continue;
      const po = parseParamOverridesField(obj.paramOverrides ?? obj.param_overrides);
      parsed.push({
        kind: "call",
        id: typeof obj.id === "string" ? obj.id : `call-${parsed.length + 1}`,
        stepNumber: typeof obj.stepNumber === "number" ? obj.stepNumber : parsed.length + 1,
        calledTestCaseId: calledTestCaseId.trim(),
        calledTitle: typeof obj.calledTitle === "string" ? obj.calledTitle : undefined,
        ...(po ? { paramOverrides: po } : {}),
      });
      continue;
    }

    const fallbackName = typeof obj.action === "string" ? obj.action : "";
    const step: TestStep = {
      id: typeof obj.id === "string" ? obj.id : `step-${parsed.length + 1}`,
      stepNumber: typeof obj.stepNumber === "number" ? obj.stepNumber : parsed.length + 1,
      name: typeof obj.name === "string" ? obj.name : fallbackName,
      description: typeof obj.description === "string" ? obj.description : "",
      expectedResult: typeof obj.expectedResult === "string" ? obj.expectedResult : "",
      status: "not-executed",
      actualResult: typeof obj.actualResult === "string" ? obj.actualResult : undefined,
      notes: typeof obj.notes === "string" ? obj.notes : undefined,
    };
    parsed.push(step);
  }

  return normalizeTestPlan(parsed);
}

export function normalizeTestPlan(entries: TestPlanEntry[]): TestPlanEntry[] {
  return entries.map((entry, idx) => {
    if (isTestPlanCall(entry)) {
      return { ...entry, stepNumber: idx + 1 };
    }
    return { ...entry, stepNumber: idx + 1 };
  });
}

/** JSON-serializable rows for custom field persistence. */
export function serializeTestPlan(entries: TestPlanEntry[]): unknown[] {
  return entries.map((entry) => {
    if (isTestPlanCall(entry)) {
      const row: Record<string, unknown> = {
        kind: "call",
        id: entry.id,
        stepNumber: entry.stepNumber,
        calledTestCaseId: entry.calledTestCaseId,
      };
      if (entry.calledTitle) row.calledTitle = entry.calledTitle;
      if (entry.paramOverrides && Object.keys(entry.paramOverrides).length > 0) {
        row.paramOverrides = entry.paramOverrides;
      }
      return row;
    }
    return {
      kind: "step",
      id: entry.id,
      stepNumber: entry.stepNumber,
      name: entry.name,
      description: entry.description,
      expectedResult: entry.expectedResult,
      status: entry.status,
      ...(entry.actualResult !== undefined ? { actualResult: entry.actualResult } : {}),
      ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
    };
  });
}

export interface ExpandTestPlanOptions {
  /** Root test-case id (caller) — blocks self-call. */
  rootTestId?: string;
  maxDepth?: number;
}

export type LoadCalleeStepsFn = (testCaseId: string) => Promise<unknown | null>;

export interface ExpandTestPlanResult {
  steps: TestStep[];
  error?: string;
}

/**
 * Flatten plan for execution: inline steps keep ids; nested steps get `call:<callRowId>:<innerId>`.
 */
export async function expandTestPlan(
  entries: TestPlanEntry[],
  loadCalleeSteps: LoadCalleeStepsFn,
  options: ExpandTestPlanOptions = {},
): Promise<ExpandTestPlanResult> {
  const maxDepth = options.maxDepth ?? DEFAULT_EXPAND_MAX_DEPTH;

  async function expandInner(
    planEntries: TestPlanEntry[],
    visitedTestIds: Set<string>,
    depth: number,
  ): Promise<{ steps: TestStep[]; error?: string }> {
    if (depth > maxDepth) {
      return { steps: [], error: `Test plan exceeds max call depth (${maxDepth}).` };
    }

    const out: TestStep[] = [];

    for (const entry of planEntries) {
      if (!isTestPlanCall(entry)) {
        out.push({ ...entry });
        continue;
      }

      const calleeId = entry.calledTestCaseId;
      if (options.rootTestId && calleeId === options.rootTestId) {
        return { steps: [], error: "A test cannot call itself." };
      }
      if (visitedTestIds.has(calleeId)) {
        return { steps: [], error: "Circular test call detected." };
      }

      const raw = await loadCalleeSteps(calleeId);
      if (raw === null || raw === undefined) {
        return {
          steps: [],
          error: `Called test case could not be loaded (id: ${calleeId.slice(0, 8)}…).`,
        };
      }

      const innerPlan = parseTestPlan(raw);
      const nextVisited = new Set(visitedTestIds);
      nextVisited.add(calleeId);

      const inner = await expandInner(innerPlan, nextVisited, depth + 1);
      if (inner.error) return inner;

      for (const st of inner.steps) {
        out.push({
          ...st,
          id: `call:${entry.id}:${st.id}`,
          stepNumber: out.length + 1,
        });
      }
    }

    return { steps: out };
  }

  const result = await expandInner(entries, new Set(), 0);
  if (result.error) return result;

  const steps = result.steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
  return { steps };
}

/**
 * Preorder DFS: merge each call row’s `paramOverrides`, then recurse into callee plans.
 * Later nodes override earlier keys. Same visit/depth rules as `expandTestPlan` (stops on cycle/self-call/load failure).
 */
export async function collectCallParamOverridesPreorder(
  entries: TestPlanEntry[],
  loadCalleeSteps: LoadCalleeStepsFn,
  options: ExpandTestPlanOptions = {},
): Promise<Record<string, string>> {
  const maxDepth = options.maxDepth ?? DEFAULT_EXPAND_MAX_DEPTH;
  const acc: Record<string, string> = {};

  async function walk(planEntries: TestPlanEntry[], visitedTestIds: Set<string>, depth: number): Promise<boolean> {
    if (depth > maxDepth) return false;

    for (const entry of planEntries) {
      if (!isTestPlanCall(entry)) continue;
      if (entry.paramOverrides) Object.assign(acc, entry.paramOverrides);

      const calleeId = entry.calledTestCaseId;
      if (options.rootTestId && calleeId === options.rootTestId) return false;
      if (visitedTestIds.has(calleeId)) return false;

      const raw = await loadCalleeSteps(calleeId);
      if (raw === null || raw === undefined) return false;

      const innerPlan = parseTestPlan(raw);
      const nextVisited = new Set(visitedTestIds);
      nextVisited.add(calleeId);

      const ok = await walk(innerPlan, nextVisited, depth + 1);
      if (!ok) return false;
    }
    return true;
  }

  await walk(entries, new Set(), 0);
  return acc;
}

/** Collect called test-case ids (shallow + one level scan only — use expand for full graph). */
export function collectCalledTestCaseIds(entries: TestPlanEntry[]): string[] {
  const ids: string[] = [];
  for (const e of entries) {
    if (isTestPlanCall(e)) ids.push(e.calledTestCaseId);
  }
  return [...new Set(ids)];
}
