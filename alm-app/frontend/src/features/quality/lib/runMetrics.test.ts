import { describe, it, expect } from "vitest";
import {
  formatRunEnvironmentLabel,
  parseRunMetricsPayload,
  stringifyRunMetricsPayload,
  RUN_METRICS_VERSION,
  summarizeRunMetrics,
} from "./runMetrics";

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

  it("rejects non-v1 shapes", () => {
    expect(parseRunMetricsPayload(JSON.stringify([{ testId: "x", status: "passed", stepResults: [] }]))).toBeNull();
    expect(parseRunMetricsPayload(JSON.stringify({ testResults: { t1: { status: "failed", stepResults: [] } } }))).toBeNull();
    expect(parseRunMetricsPayload(JSON.stringify({ v: 2, results: [] }))).toBeNull();
    expect(parseRunMetricsPayload(JSON.stringify({ v: 1 }))).toBeNull();
  });

  it("accepts v1 with empty results", () => {
    expect(parseRunMetricsPayload(JSON.stringify({ v: RUN_METRICS_VERSION, results: [] }))).toEqual([]);
  });

  it("summarizes result statuses", () => {
    expect(summarizeRunMetrics(null)).toEqual({
      passed: 0,
      failed: 0,
      blocked: 0,
      notExecuted: 0,
      total: 0,
    });
    expect(
      summarizeRunMetrics([
        { testId: "a", status: "passed", stepResults: [] },
        { testId: "b", status: "failed", stepResults: [] },
        { testId: "c", status: "blocked", stepResults: [] },
        { testId: "d", status: "not-executed", stepResults: [] },
      ]),
    ).toEqual({ passed: 1, failed: 1, blocked: 1, notExecuted: 1, total: 4 });
  });

  it("formats environment from custom fields", () => {
    expect(formatRunEnvironmentLabel(undefined)).toBe("—");
    expect(formatRunEnvironmentLabel({})).toBe("—");
    expect(formatRunEnvironmentLabel({ environment: "Prod" })).toBe("Prod");
    expect(formatRunEnvironmentLabel({ Environment: "  UAT  " })).toBe("UAT");
    expect(formatRunEnvironmentLabel({ target_environment: "dev" })).toBe("dev");
  });
});
