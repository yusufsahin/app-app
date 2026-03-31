import type { RunMetricsSummary, TestExecutionResultRow } from "./runMetrics";

/** Stable key for a result row (parametric rows use paramRowIndex; else index). */
export function resultRowKey(row: TestExecutionResultRow, index: number): string {
  const pr = row.paramRowIndex;
  return `${row.testId}\0${pr == null ? `i${index}` : `p${pr}`}`;
}

export type RunCompareRow = {
  key: string;
  displayIndex: string;
  previous: TestExecutionResultRow["status"] | null;
  current: TestExecutionResultRow["status"] | null;
  kind: "changed" | "new" | "removed";
};

export function compareRunResultRows(
  previous: TestExecutionResultRow[] | null | undefined,
  current: TestExecutionResultRow[],
): RunCompareRow[] {
  const prev = previous ?? [];
  const prevByKey = new Map<string, TestExecutionResultRow>();
  prev.forEach((row, i) => {
    prevByKey.set(resultRowKey(row, i), row);
  });
  const currByKey = new Map<string, TestExecutionResultRow>();
  current.forEach((row, i) => {
    currByKey.set(resultRowKey(row, i), row);
  });

  const out: RunCompareRow[] = [];

  current.forEach((row, i) => {
    const k = resultRowKey(row, i);
    const p = prevByKey.get(k);
    if (!p) {
      out.push({
        key: k,
        displayIndex: String(i + 1),
        previous: null,
        current: row.status,
        kind: "new",
      });
    } else if (p.status !== row.status) {
      out.push({
        key: k,
        displayIndex: String(i + 1),
        previous: p.status,
        current: row.status,
        kind: "changed",
      });
    }
  });

  prev.forEach((row, i) => {
    const k = resultRowKey(row, i);
    if (!currByKey.has(k)) {
      out.push({
        key: k,
        displayIndex: String(i + 1),
        previous: row.status,
        current: null,
        kind: "removed",
      });
    }
  });

  return out;
}

export function diffRunMetricSummaries(prev: RunMetricsSummary, curr: RunMetricsSummary): RunMetricsSummary {
  return {
    passed: curr.passed - prev.passed,
    failed: curr.failed - prev.failed,
    blocked: curr.blocked - prev.blocked,
    notExecuted: curr.notExecuted - prev.notExecuted,
    total: curr.total - prev.total,
  };
}

export function isZeroSummaryDelta(d: RunMetricsSummary): boolean {
  return d.passed === 0 && d.failed === 0 && d.blocked === 0 && d.notExecuted === 0 && d.total === 0;
}
