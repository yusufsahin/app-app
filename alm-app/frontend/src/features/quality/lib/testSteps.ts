import type { TestStep } from "../types";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function normalizeTestSteps(steps: TestStep[]): TestStep[] {
  return steps.map((step, idx) => ({
    ...step,
    stepNumber: idx + 1,
  }));
}

export function parseTestSteps(raw: unknown): TestStep[] {
  let items = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      items = JSON.parse(raw);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) return [];
  const parsed: TestStep[] = [];
  for (const item of items) {
    const obj = asObject(item);
    if (!obj) continue;
    const fallbackName = typeof obj.action === "string" ? obj.action : "";
    parsed.push({
      id: typeof obj.id === "string" ? obj.id : `step-${parsed.length + 1}`,
      stepNumber: typeof obj.stepNumber === "number" ? obj.stepNumber : parsed.length + 1,
      name: typeof obj.name === "string" ? obj.name : fallbackName,
      description: typeof obj.description === "string" ? obj.description : "",
      expectedResult: typeof obj.expectedResult === "string" ? obj.expectedResult : "",
      status: "not-executed",
      actualResult: typeof obj.actualResult === "string" ? obj.actualResult : undefined,
      notes: typeof obj.notes === "string" ? obj.notes : undefined,
    });
  }
  return normalizeTestSteps(parsed);
}

