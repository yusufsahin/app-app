import { describe, it, expect } from "vitest";
import { compareRunResultRows, diffRunMetricSummaries, isZeroSummaryDelta, resultRowKey } from "./runMetricsCompare";
import type { TestExecutionResultRow } from "./runMetrics";

function row(
  testId: string,
  status: TestExecutionResultRow["status"],
  paramRowIndex?: number | null,
): TestExecutionResultRow {
  return {
    testId,
    status,
    stepResults: [],
    paramRowIndex: paramRowIndex ?? null,
  };
}

describe("runMetricsCompare", () => {
  it("resultRowKey distinguishes param rows", () => {
    const a = row("t1", "passed", 0);
    const b = row("t1", "failed", 1);
    expect(resultRowKey(a, 0)).not.toBe(resultRowKey(b, 1));
  });

  it("compareRunResultRows detects new and removed", () => {
    const prev = [row("a", "passed"), row("b", "failed")];
    const curr = [row("a", "passed"), row("c", "blocked")];
    const diff = compareRunResultRows(prev, curr);
    expect(diff.some((d) => d.kind === "new" && d.current === "blocked")).toBe(true);
    expect(diff.some((d) => d.kind === "removed" && d.previous === "failed")).toBe(true);
  });

  it("compareRunResultRows detects status change", () => {
    const prev = [row("a", "failed")];
    const curr = [row("a", "passed")];
    const diff = compareRunResultRows(prev, curr);
    expect(diff).toEqual([
      expect.objectContaining({ kind: "changed", previous: "failed", current: "passed" }),
    ]);
  });

  it("diffRunMetricSummaries and isZeroSummaryDelta", () => {
    const d = diffRunMetricSummaries(
      { passed: 1, failed: 2, blocked: 0, notExecuted: 1, total: 4 },
      { passed: 3, failed: 1, blocked: 0, notExecuted: 0, total: 4 },
    );
    expect(d.passed).toBe(2);
    expect(d.failed).toBe(-1);
    expect(isZeroSummaryDelta(d)).toBe(false);
    expect(
      isZeroSummaryDelta({ passed: 0, failed: 0, blocked: 0, notExecuted: 0, total: 0 }),
    ).toBe(true);
  });
});
