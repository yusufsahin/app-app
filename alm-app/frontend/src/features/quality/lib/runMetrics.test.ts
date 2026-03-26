import { describe, it, expect } from "vitest";
import { parseRunMetricsPayload, stringifyRunMetricsPayload, RUN_METRICS_VERSION } from "./runMetrics";

describe("runMetrics", () => {
  it("round-trips v1 document", () => {
    const results = [
      { testId: "t1", status: "not-executed" as const, stepResults: [{ stepId: "s1", status: "not-executed" as const }] },
    ];
    const s = stringifyRunMetricsPayload(results);
    const parsed = JSON.parse(s) as { v: number; results: unknown };
    expect(parsed.v).toBe(RUN_METRICS_VERSION);
    expect(parseRunMetricsPayload(s)).toEqual(results);
  });

  it("parses legacy array", () => {
    const arr = [{ testId: "x", status: "passed" as const, stepResults: [] }];
    expect(parseRunMetricsPayload(JSON.stringify(arr))).toEqual(arr);
  });

  it("parses legacy testResults record", () => {
    const raw = {
      testResults: {
        t1: { status: "failed", stepResults: [{ stepId: "s1", status: "failed" as const }] },
      },
    };
    const out = parseRunMetricsPayload(JSON.stringify(raw));
    expect(out).toHaveLength(1);
    expect(out?.[0]?.testId).toBe("t1");
    expect(out?.[0]?.status).toBe("failed");
  });
});
