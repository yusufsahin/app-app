import { describe, it, expect } from "vitest";
import { buildBugReportMarkdown } from "./bugReportMarkdown";
import type { TestStep, StepResult } from "../types";

describe("buildBugReportMarkdown", () => {
  const step: TestStep = {
    id: "s1",
    stepNumber: 2,
    name: "Login",
    description: 'Use `<special>` & chars',
    expectedResult: "OK",
    status: "failed",
  };
  const stepResult: StepResult = {
    stepId: "s1",
    status: "failed",
    actualResult: "Error ```code```",
    notes: "",
  };

  it("includes test, run, step and escaping-safe text", () => {
    const md = buildBugReportMarkdown({
      test: { id: "t1", title: "TC Login", artifact_key: "P-12" },
      run: { id: "r1", title: "Run A", artifact_key: "R-1" },
      step,
      stepResult,
      reportedAt: "2099-01-01",
    });
    expect(md).toContain("BUG REPORT: TC Login (Step 2)");
    expect(md).toContain("**Test Case ID:** P-12");
    expect(md).toContain("**Run ID:** R-1");
    expect(md).toContain("Use `<special>` & chars");
    expect(md).toContain("Error ```code```");
    expect(md).toContain("**Run:** Run A");
    expect(md).toContain("2099-01-01");
  });

  it("handles missing run and empty actual", () => {
    const md = buildBugReportMarkdown({
      test: { id: "t1", title: "T", artifact_key: "" },
      run: null,
      step: { ...step, description: "", status: "failed" },
      stepResult: { ...stepResult, actualResult: "" },
      reportedAt: "fixed",
    });
    expect(md).toContain("**Run ID:** N/A");
    expect(md).toContain("No actual result provided");
    expect(md).toContain("**Run:** N/A");
  });
});
