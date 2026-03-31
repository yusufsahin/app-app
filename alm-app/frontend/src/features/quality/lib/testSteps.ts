import type { TestStep } from "../types";
import { isTestPlanCall } from "../types";
import { parseTestPlan } from "./testPlan";

export function normalizeTestSteps(steps: TestStep[]): TestStep[] {
  return steps.map((step, idx) => ({
    ...step,
    stepNumber: idx + 1,
  }));
}

/** Inline steps only — drops `kind: call` rows (execution uses `expandTestPlan` for those). */
export function parseTestSteps(raw: unknown): TestStep[] {
  return parseTestPlan(raw).filter((e): e is TestStep => !isTestPlanCall(e));
}

