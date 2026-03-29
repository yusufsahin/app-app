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
