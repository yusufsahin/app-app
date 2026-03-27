/** @vitest-environment node */
import { describe, it, expect, vi } from "vitest";
import {
  parseTestPlan,
  normalizeTestPlan,
  expandTestPlan,
  serializeTestPlan,
  collectCalledTestCaseIds,
  collectCallParamOverridesPreorder,
} from "./testPlan";
import { isTestPlanCall } from "../types";

describe("parseTestPlan", () => {
  it("parses legacy inline rows without kind", () => {
    const out = parseTestPlan([{ id: "a", name: "Click" }]);
    expect(out).toHaveLength(1);
    expect(isTestPlanCall(out[0]!)).toBe(false);
    expect(out[0]).toMatchObject({ id: "a", name: "Click", stepNumber: 1 });
  });

  it("parses call rows", () => {
    const out = parseTestPlan([
      { kind: "call", id: "c1", calledTestCaseId: "550e8400-e29b-41d4-a716-446655440000", calledTitle: "T" },
    ]);
    expect(out).toHaveLength(1);
    expect(isTestPlanCall(out[0]!)).toBe(true);
    expect(out[0]).toMatchObject({
      kind: "call",
      calledTestCaseId: "550e8400-e29b-41d4-a716-446655440000",
      calledTitle: "T",
    });
  });

  it("parses kind step as inline", () => {
    const out = parseTestPlan([{ kind: "step", id: "s", name: "N", description: "", expectedResult: "" }]);
    expect(isTestPlanCall(out[0]!)).toBe(false);
  });
});

describe("serializeTestPlan", () => {
  it("round-trips call paramOverrides", () => {
    const plan = normalizeTestPlan([
      {
        kind: "call" as const,
        id: "c",
        stepNumber: 1,
        calledTestCaseId: "uuid-1",
        paramOverrides: { env: "staging", n: "1" },
      },
    ]);
    const again = parseTestPlan(serializeTestPlan(plan));
    expect(isTestPlanCall(again[0]!)).toBe(true);
    expect((again[0] as { paramOverrides?: Record<string, string> }).paramOverrides).toEqual({
      env: "staging",
      n: "1",
    });
  });

  it("round-trips inline and call", () => {
    const plan = normalizeTestPlan([
      { id: "s", stepNumber: 1, name: "A", description: "", expectedResult: "", status: "not-executed" },
      {
        kind: "call" as const,
        id: "c",
        stepNumber: 2,
        calledTestCaseId: "uuid-1",
      },
    ]);
    const json = serializeTestPlan(plan);
    const again = parseTestPlan(json);
    expect(again).toHaveLength(2);
    expect(isTestPlanCall(again[1]!)).toBe(true);
  });
});

describe("expandTestPlan", () => {
  it("flattens a single call with inline callee steps", async () => {
    const calleeId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const load = vi.fn(async (id: string) => {
      if (id === calleeId) {
        return [{ id: "x", name: "Inner", description: "", expectedResult: "" }];
      }
      return null;
    });
    const plan = normalizeTestPlan([
      {
        kind: "call",
        id: "callrow",
        stepNumber: 1,
        calledTestCaseId: calleeId,
      },
    ]);
    const { steps, error } = await expandTestPlan(plan, load, {
      rootTestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(error).toBeUndefined();
    expect(steps).toHaveLength(1);
    expect(steps[0]?.id).toBe("call:callrow:x");
    expect(steps[0]?.name).toBe("Inner");
  });

  it("detects self-call", async () => {
    const root = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const plan = normalizeTestPlan([
      { kind: "call", id: "c", stepNumber: 1, calledTestCaseId: root },
    ]);
    const { error } = await expandTestPlan(plan, vi.fn(), { rootTestId: root });
    expect(error).toMatch(/cannot call itself/i);
  });

  it("collectCallParamOverridesPreorder merges preorder; deeper call overrides keys", async () => {
    const innerId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const midId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const load = vi.fn(async (id: string) => {
      if (id === midId) {
        return [
          {
            kind: "call",
            id: "nested",
            calledTestCaseId: innerId,
            paramOverrides: { a: "fromNestedCall" },
          },
        ];
      }
      if (id === innerId) return [{ id: "s", name: "leaf" }];
      return null;
    });
    const plan = parseTestPlan([
      {
        kind: "call",
        id: "rootc",
        calledTestCaseId: midId,
        paramOverrides: { a: "fromRootCall", b: "keep" },
      },
    ]);
    const acc = await collectCallParamOverridesPreorder(plan, load, {
      rootTestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(acc).toEqual({ a: "fromNestedCall", b: "keep" });
  });

  it("detects cycle", async () => {
    const a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const load = vi.fn(async (id: string) => {
      if (id === b) return [{ kind: "call", id: "inner", calledTestCaseId: a }];
      if (id === a) return [{ kind: "call", id: "toB", calledTestCaseId: b }];
      return null;
    });
    const plan = parseTestPlan([{ kind: "call", id: "x", calledTestCaseId: b }]);
    const { error } = await expandTestPlan(plan, load, { rootTestId: "root-root-root-root-root-root-root" });
    expect(error).toMatch(/Circular/i);
  });
});

describe("collectCalledTestCaseIds", () => {
  it("returns unique callee ids", () => {
    const ids = collectCalledTestCaseIds(
      parseTestPlan([
        { kind: "call", id: "a", calledTestCaseId: "u1" },
        { kind: "call", id: "b", calledTestCaseId: "u1" },
      ]),
    );
    expect(ids).toEqual(["u1"]);
  });
});
