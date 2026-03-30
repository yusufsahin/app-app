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
        kind: "step",
        id: "s1",
        name: "Click login",
        description: "Use valid user",
        expectedResult: "Dashboard",
        status: "not-executed",
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

  it("assigns fallback id when missing", () => {
    const out = parseTestSteps([
      { kind: "step", name: "A", description: "", expectedResult: "", status: "not-executed" },
      { kind: "step", name: "B", description: "", expectedResult: "", status: "not-executed" },
    ]);
    expect(out[0]?.id).toBe("step-1");
    expect(out[1]?.id).toBe("step-2");
  });

  it("ignores invalid items and normalizes step numbers", () => {
    const out = parseTestSteps([
      null,
      "bad",
      { kind: "step", id: "k", name: "One", description: "", expectedResult: "", status: "not-executed" },
      { kind: "step", id: "m", name: "Two", description: "", expectedResult: "", status: "not-executed" },
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
      {
        kind: "step",
        name: "Keep",
        id: "k",
        description: "",
        expectedResult: "",
        status: "not-executed",
      },
      { kind: "call", id: "c", calledTestCaseId: "550e8400-e29b-41d4-a716-446655440000" },
    ]);
    const out = parseTestSteps(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("Keep");
  });

  it("parses array passed directly", () => {
    const out = parseTestSteps([
      {
        kind: "step",
        id: "p",
        name: "Step",
        description: "",
        expectedResult: "OK",
        status: "not-executed",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.expectedResult).toBe("OK");
  });
});
