import type { TestStep } from "../types";
import { isTestPlanCall } from "../types";
import { parseTestPlan } from "./testPlan";

export function normalizeTestSteps(steps: TestStep[]): TestStep[] {
  return steps.map((step, idx) => ({
    ...step,
    stepNumber: idx + 1,
  }));
}

/** Inline steps only — ignores `kind: call` rows (legacy consumers / simple previews). */
export function parseTestSteps(raw: unknown): TestStep[] {
  return parseTestPlan(raw).filter((e): e is TestStep => !isTestPlanCall(e));
}

