import { describe, it, expect } from "vitest";
import { normalizeTestSteps, parseTestSteps } from "./testSteps";
import type { TestStep } from "../types";

describe("normalizeTestSteps", () => {
  it("renumbers steps from 1 in order", () => {
    const steps: TestStep[] = [
      {
        id: "a",
        stepNumber: 99,
        name: "x",
        description: "",
        expectedResult: "",
        status: "not-executed",
      },
      {
        id: "b",
        stepNumber: 1,
        name: "y",
        description: "",
        expectedResult: "",
        status: "not-executed",
      },
    ];
    const out = normalizeTestSteps(steps);
    expect(out[0]?.stepNumber).toBe(1);
    expect(out[1]?.stepNumber).toBe(2);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeTestSteps([])).toEqual([]);
  });
});

describe("parseTestSteps", () => {
  it("returns empty array for null, non-array, and empty string", () => {
    expect(parseTestSteps(null)).toEqual([]);
    expect(parseTestSteps(undefined)).toEqual([]);
    expect(parseTestSteps({})).toEqual([]);
    expect(parseTestSteps("")).toEqual([]);
    expect(parseTestSteps("   ")).toEqual([]);
  });

  it("parses JSON string array", () => {
    const raw = JSON.stringify([
      {
        id: "s1",
        name: "Click login",
        description: "Use valid user",
        expectedResult: "Dashboard",
      },
    ]);
    const out = parseTestSteps(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("s1");
    expect(out[0]?.name).toBe("Click login");
    expect(out[0]?.description).toBe("Use valid user");
    expect(out[0]?.expectedResult).toBe("Dashboard");
    expect(out[0]?.stepNumber).toBe(1);
    expect(out[0]?.status).toBe("not-executed");
  });

  it("maps legacy action field to name when name missing", () => {
    const out = parseTestSteps([{ action: "Open app", id: "x" }]);
    expect(out[0]?.name).toBe("Open app");
    expect(out[0]?.id).toBe("x");
  });

  it("prefers name over action when both present", () => {
    const out = parseTestSteps([{ name: "Primary", action: "Ignored", id: "z" }]);
    expect(out[0]?.name).toBe("Primary");
  });

  it("assigns fallback id when missing", () => {
    const out = parseTestSteps([{ name: "A" }, { name: "B" }]);
    expect(out[0]?.id).toBe("step-1");
    expect(out[1]?.id).toBe("step-2");
  });

  it("ignores invalid items and normalizes step numbers", () => {
    const out = parseTestSteps([
      null,
      "bad",
      { id: "k", name: "One" },
      { id: "m", name: "Two", stepNumber: 10 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.stepNumber).toBe(1);
    expect(out[1]?.stepNumber).toBe(2);
  });

  it("returns empty array for invalid JSON string", () => {
    expect(parseTestSteps("{not json")).toEqual([]);
  });

  it("drops call rows for inline-only parseTestSteps", () => {
    const raw = JSON.stringify([
      { name: "Keep", id: "k" },
      { kind: "call", id: "c", calledTestCaseId: "550e8400-e29b-41d4-a716-446655440000" },
    ]);
    const out = parseTestSteps(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("Keep");
  });

  it("parses array passed directly", () => {
    const out = parseTestSteps([{ id: "p", name: "Step", expectedResult: "OK" }]);
    expect(out).toHaveLength(1);
    expect(out[0]?.expectedResult).toBe("OK");
  });
});
