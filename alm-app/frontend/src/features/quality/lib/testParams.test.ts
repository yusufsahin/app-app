import { describe, it, expect } from "vitest";
import {
  parseTestParams,
  normalizeTestParams,
  serializeTestParams,
  buildParamValuesMap,
  applyTestParamsToText,
  applyTestParamsToStep,
  listUnresolvedInText,
  extractReferencedParamNamesFromPlan,
  defaultsFromDefs,
} from "./testParams";
import type { TestPlanEntry } from "../types";

describe("testParams", () => {
  it("parseTestParams returns null for empty or invalid", () => {
    expect(parseTestParams(null)).toBeNull();
    expect(parseTestParams({})).toBeNull();
    expect(parseTestParams({ defs: [] })).toBeNull();
    expect(parseTestParams("{bad")).toBeNull();
  });

  it("parseTestParams accepts JSON string", () => {
    const doc = parseTestParams(JSON.stringify({ defs: [{ name: "u", default: "a" }] }));
    expect(doc?.defs).toEqual([{ name: "u", label: undefined, default: "a" }]);
  });

  it("normalizeTestParams dedupes defs and keeps rows with values object only", () => {
    const n = normalizeTestParams({
      defs: [
        { name: "a", default: "1" },
        { name: "a", default: "2" },
        { name: "b" },
      ],
      rows: [{ values: { a: "x", b: "y" } }],
    });
    expect(n.defs.map((d) => d.name)).toEqual(["a", "b"]);
    expect(n.rows?.[0]?.values).toEqual({ a: "x", b: "y" });
  });

  it("buildParamValuesMap uses defaults then row", () => {
    const doc = normalizeTestParams({
      defs: [
        { name: "u", default: "defU" },
        { name: "p", default: "" },
      ],
      rows: [{ values: { u: "rowU", p: "rowP" } }],
    });
    expect(buildParamValuesMap(doc, null)).toEqual({ u: "defU", p: "" });
    expect(buildParamValuesMap(doc, 0)).toEqual({ u: "rowU", p: "rowP" });
  });

  it("applyTestParamsToText replaces placeholders", () => {
    expect(applyTestParamsToText("Hi ${u}", { u: "X" })).toBe("Hi X");
    expect(applyTestParamsToText("Hi ${missing}", { u: "X" })).toBe("Hi ${missing}");
  });

  it("applyTestParamsToStep maps all text fields", () => {
    const s = applyTestParamsToStep(
      {
        id: "1",
        stepNumber: 1,
        name: "N ${a}",
        description: "D ${a}",
        expectedResult: "E ${b}",
        status: "not-executed",
      },
      { a: "1", b: "2" },
    );
    expect(s.name).toBe("N 1");
    expect(s.description).toBe("D 1");
    expect(s.expectedResult).toBe("E 2");
  });

  it("listUnresolvedInText lists missing keys", () => {
    expect(listUnresolvedInText("A ${x} B ${y}", { x: "1" }).sort()).toEqual(["y"]);
  });

  it("extractReferencedParamNamesFromPlan skips calls", () => {
    const entries: TestPlanEntry[] = [
      {
        id: "s1",
        stepNumber: 1,
        name: "Do ${a}",
        description: "",
        expectedResult: "",
        status: "not-executed",
      },
      {
        kind: "call",
        id: "c1",
        stepNumber: 2,
        calledTestCaseId: "x",
      },
    ];
    expect([...extractReferencedParamNamesFromPlan(entries)]).toEqual(["a"]);
  });

  it("defaultsFromDefs only non-empty defaults", () => {
    expect(
      defaultsFromDefs([
        { name: "a", default: "z" },
        { name: "b", default: "" },
      ]),
    ).toEqual({ a: "z" });
  });

  it("serializeTestParams roundtrips through parse", () => {
    const doc = normalizeTestParams({
      defs: [{ name: "x", label: "L" }],
      rows: [{ label: "R1", values: { x: "v" } }],
    });
    const raw = serializeTestParams(doc);
    const again = parseTestParams(raw);
    expect(again?.defs).toEqual(doc.defs);
    expect(again?.rows).toEqual(doc.rows);
  });
});
