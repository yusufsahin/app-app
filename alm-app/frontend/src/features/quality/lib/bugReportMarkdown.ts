import type { Artifact } from "../../../shared/stores/artifactStore";
import type { StepResult, TestStep } from "../types";

export type BugReportContext = {
  test: Pick<Artifact, "id" | "title" | "artifact_key">;
  run: Pick<Artifact, "id" | "title" | "artifact_key"> | null;
  step: TestStep;
  stepResult: StepResult;
  /** ISO or locale string; defaults to now */
  reportedAt?: string;
};

export function buildBugReportMarkdown(ctx: BugReportContext): string {
  const { test, run, step, stepResult } = ctx;
  const at = ctx.reportedAt ?? new Date().toLocaleString();
  const testId = test.artifact_key || test.id;
  const runId = run?.artifact_key || run?.id || "N/A";
  const runTitle = run?.title ?? "N/A";

  return `
# BUG REPORT: ${test.title ?? "Test"} (Step ${step.stepNumber})

**Test Case ID:** ${testId}
**Run ID:** ${runId}

## Step Details
- **Name:** ${step.name}
- **Description:** ${step.description || "N/A"}
- **Expected Result:** ${step.expectedResult}
- **Actual Result:** ${stepResult.actualResult || "No actual result provided"}

## Execution Context
- **Run:** ${runTitle}
- **Date:** ${at}
`.trim();
}
