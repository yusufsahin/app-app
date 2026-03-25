import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layout,
  ArrowLeft,
  Clock,
  Play,
  Save,
  Flag,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "../../../shared/components/ui";
import { useArtifact, useUpdateArtifact, useArtifacts } from "../../../shared/api/artifactApi";
import { useArtifactLinks } from "../../../shared/api/artifactLinkApi";
import { ExecutionStepList } from "./ExecutionStepList";
import type { TestStep, StepResult } from "../types";
import { parseRunMetricsPayload, stringifyRunMetricsPayload } from "../lib/runMetrics";
import { toast } from "sonner";

interface TestExecutionState {
  testId: string;
  status: "passed" | "failed" | "blocked" | "not-executed";
  stepResults: StepResult[];
}

interface ManualExecutionPlayerCoreProps {
  orgSlug: string;
  projectSlug: string;
  runId: string;
  onExit: () => void;
  onSave?: () => void;
  fullScreen?: boolean;
}

export function ManualExecutionPlayerCore({
  orgSlug,
  projectSlug,
  runId,
  onExit,
  onSave,
  fullScreen = false,
}: ManualExecutionPlayerCoreProps) {
  // Data fetching
  const { data: run, isLoading: runLoading } = useArtifact(orgSlug, projectSlug, runId);
  const { data: runLinks = [], isLoading: linksLoading } = useArtifactLinks(
    orgSlug,
    projectSlug,
    runId,
  );

  const suiteId = useMemo(
    () => runLinks.find((l) => l.link_type === "run_for_suite")?.to_artifact_id,
    [runLinks],
  );

  const { data: suiteLinks = [], isLoading: suiteLinksLoading } = useArtifactLinks(
    orgSlug,
    projectSlug,
    suiteId,
  );

  const linkedTestIds = useMemo(() => {
    const fromSuite = suiteId
      ? suiteLinks.filter((l) => l.link_type === "suite_includes_test").map((l) => l.to_artifact_id)
      : [];
    if (fromSuite.length > 0) return fromSuite;
    return runLinks.map((l) => l.to_artifact_id);
  }, [suiteId, suiteLinks, runLinks]);

  const { data: testsData, isLoading: testsLoading } = useArtifacts(
    orgSlug,
    projectSlug,
    undefined,
    "test-case",
    "updated_at",
    "desc",
    undefined,
    500,
    0,
    false,
    undefined,
    undefined,
    undefined,
    "quality",
    false,
  );
  const updateRunMutation = useUpdateArtifact(orgSlug, projectSlug, runId);

  // Local state for the execution session
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [testExecutionResults, setTestExecutionResults] = useState<TestExecutionState[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const testsById = useMemo(
    () => new Map((testsData?.items ?? []).map((t) => [t.id, t])),
    [testsData?.items],
  );

  const activeTests = useMemo(() => {
    return linkedTestIds
      .map((id) => testsById.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);
  }, [linkedTestIds, testsById]);

  // Initialize results from run or create new ones
  useEffect(() => {
    if (!run || isInitialized) return;
    if (runLoading || linksLoading || testsLoading) return;
    if (suiteId && suiteLinksLoading) return;

    const saved = parseRunMetricsPayload(run.custom_fields?.run_metrics_json);
    let initialResults: TestExecutionState[] = [];

    if (saved && saved.length > 0) {
      initialResults = saved;
    } else if (activeTests.length > 0) {
      initialResults = activeTests.map((test) => {
        let steps: TestStep[] = [];
        if (test.custom_fields?.test_steps_json) {
          try {
            steps = JSON.parse(String(test.custom_fields.test_steps_json)) as TestStep[];
          } catch (e) {
            console.error(`Failed to parse test_steps_json for test ${test.id}`, e);
          }
        }

        return {
          testId: test.id,
          status: "not-executed" as const,
          stepResults: steps.map((step) => ({
            stepId: String(step.id),
            status: "not-executed" as const,
          })),
        };
      });
    }

    setTestExecutionResults(initialResults);
    setCurrentTestIndex(0);
    setIsInitialized(true);
  }, [
    run,
    runLoading,
    linksLoading,
    testsLoading,
    suiteId,
    suiteLinksLoading,
    activeTests,
    isInitialized,
  ]);

  const currentResult = testExecutionResults[currentTestIndex];
  const currentTest = activeTests.find((t) => t.id === currentResult?.testId);

  useEffect(() => {
    if (testExecutionResults.length === 0) return;
    if (currentTestIndex >= testExecutionResults.length) {
      setCurrentTestIndex(0);
    }
  }, [testExecutionResults.length, currentTestIndex]);

  // Handlers
  const handleStepUpdate = (
    stepId: string,
    status: StepResult["status"],
    actualResult?: string,
    notes?: string,
  ) => {
    const newResults = [...testExecutionResults];
    const testResult = newResults[currentTestIndex];
    if (!testResult) return;

    const stepResultIndex = testResult.stepResults.findIndex((r) => r.stepId === stepId);

    if (stepResultIndex !== -1) {
      const existing = testResult.stepResults[stepResultIndex];
      if (!existing) return;
      const updatedStatus = status === "not-executed" ? existing.status : status;

      const updatedStepResult: StepResult = {
        stepId: existing.stepId,
        status: updatedStatus,
        actualResult: actualResult !== undefined ? actualResult : existing.actualResult,
        notes: notes !== undefined ? notes : existing.notes,
      };

      testResult.stepResults[stepResultIndex] = updatedStepResult;

      // Auto-update test status based on steps
      const anyFailed = testResult.stepResults.some((r: StepResult) => r.status === "failed");
      const anyBlocked = testResult.stepResults.some((r: StepResult) => r.status === "blocked");
      const allPassed = testResult.stepResults.every((r: StepResult) => r.status === "passed");
      const anyExecuted = testResult.stepResults.some((r: StepResult) => r.status !== "not-executed");

      if (anyFailed) testResult.status = "failed";
      else if (anyBlocked) testResult.status = "blocked";
      else if (allPassed) testResult.status = "passed";
      else if (anyExecuted) testResult.status = "not-executed"; // partially executed
      else testResult.status = "not-executed";

      setTestExecutionResults(newResults);
    }
  };

  const handleCopyBugReport = (step: TestStep, stepResult: StepResult) => {
    if (!currentTest) return;

    const bugReport = `
# BUG REPORT: ${currentTest.title} (Step ${step.stepNumber})

**Test Case ID:** ${currentTest.artifact_key || currentTest.id}
**Run ID:** ${run?.artifact_key || run?.id}

## Step Details
- **Description:** ${step.action}
- **Expected Result:** ${step.expectedResult}
- **Actual Result:** ${stepResult.actualResult || "No actual result provided"}

## Execution Context
- **Run:** ${run?.title}
- **Date:** ${new Date().toLocaleString()}
`.trim();

    navigator.clipboard.writeText(bugReport);
    toast.success(`Bug report copied for step ${step.stepNumber}`);
  };

  const handlePassAllSteps = () => {
    if (!currentResult) return;
    if (!currentTest) {
      toast.error("Test case not loaded");
      return;
    }

    let steps: TestStep[] = [];
    try {
      steps = JSON.parse(String(currentTest.custom_fields?.test_steps_json || "[]"));
    } catch {
      toast.error("Failed to parse test steps");
      return;
    }

    const updatedStepResults = steps.map((step) => {
      const existing = currentResult.stepResults.find((r) => r.stepId === String(step.id));
      return {
        stepId: String(step.id),
        status: "passed" as const,
        actualResult: existing?.actualResult || "As expected",
        notes: existing?.notes || "",
      };
    });

    const newResults = [...testExecutionResults];
    newResults[currentTestIndex] = {
      ...currentResult,
      stepResults: updatedStepResults,
      status: "passed",
    };
    setTestExecutionResults(newResults);
    toast.success("All steps marked as passed");
  };

  const handleSaveAndExit = async () => {
    if (!run) return;

    try {
      await updateRunMutation.mutateAsync({
        custom_fields: {
          ...run.custom_fields,
          run_metrics_json: stringifyRunMetricsPayload(testExecutionResults),
        },
      });

      toast.success("Execution progress saved");
      if (onSave) onSave();
      onExit();
    } catch {
      toast.error("Failed to save progress");
    }
  };

  const handleNext = () => {
    if (currentTestIndex < testExecutionResults.length - 1) {
      setCurrentTestIndex(currentTestIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentTestIndex > 0) {
      setCurrentTestIndex(currentTestIndex - 1);
    }
  };

  // Loading state
  const isLoading = runLoading || linksLoading || testsLoading || (!!suiteId && suiteLinksLoading);
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-xl"></div>
          <span className="animate-pulse text-sm font-medium text-muted-foreground">
            Initializing Execution Session...
          </span>
        </div>
      </div>
    );
  }

  // Handle missing run immediately
  if (!run) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md border-destructive/20 bg-destructive/5 text-center shadow-xl">
          <CardHeader>
            <AlertCircle className="mx-auto mb-2 size-12 text-destructive" />
            <CardTitle className="text-destructive">Run not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The requested run ID could not be loaded. It may have been deleted or you may not have
              access.
            </p>
            <Button onClick={onExit} variant="outline" className="mt-6">
              Return to Project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Wait for initialization if run exists
  if (!isInitialized) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="flex flex-col items-center gap-2">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <span className="text-xs text-muted-foreground">Preparing test data...</span>
        </div>
      </div>
    );
  }

  if (activeTests.length === 0 && testExecutionResults.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md text-center shadow-lg">
          <CardHeader>
            <Flag className="mx-auto mb-2 size-12 text-muted-foreground" />
            <CardTitle>No tests linked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Link this run to a suite (<span className="font-mono text-xs">run_for_suite</span>), add tests
              to the suite (<span className="font-mono text-xs">suite_includes_test</span>), or attach test cases
              directly for legacy runs.
            </p>
            <Button onClick={onExit} variant="outline" className="mt-6">
              Close Player
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercentage = testExecutionResults.length > 0
    ? (testExecutionResults.filter((r) => r.status !== "not-executed").length / testExecutionResults.length) * 100
    : 0;

  let currentTestSteps: TestStep[] = [];
  try {
    currentTestSteps = JSON.parse(String(currentTest?.custom_fields?.test_steps_json || "[]"));
  } catch (e) {
    console.error("Failed to parse test steps", e);
  }

  return (
    <div
      className={`flex h-full flex-col overflow-hidden bg-[#F8FAFC] ${fullScreen ? "fixed inset-0 z-50" : "relative"}`}
    >
      {/* Header */}
      <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-6 shadow-sm transition-all">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="text-[#64748B] hover:text-[#1E293B]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {fullScreen ? "Exit" : "Close"}
          </Button>
          <div className="h-6 w-px bg-[#E2E8F0]" />
          <h1 className="flex items-center gap-2 truncate font-bold text-[#1E293B] md:max-w-md max-w-[200px]">
            <Play className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
            {run.title}
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-4 text-[11px] font-medium text-[#64748B] md:flex">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#94A3B8]" />
              {new Date(run.updated_at || "").toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSaveAndExit}
            disabled={updateRunMutation.isPending}
            className="h-8 bg-blue-600 shadow-sm hover:bg-blue-700"
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Test List Sidebar */}
        <aside className="hidden w-72 flex-col border-r border-[#E2E8F0] bg-white shadow-sm lg:flex">
          <div className="space-y-3 border-b border-[#E2E8F0] bg-slate-50/50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                Progress
              </span>
              <span className="text-[10px] font-bold text-blue-600">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {testExecutionResults.map((result, index) => {
                const test = activeTests.find((t) => t.id === result.testId);
                const isActive = index === currentTestIndex;

                return (
                  <button
                    key={result.testId}
                    onClick={() => setCurrentTestIndex(index)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-all ${
                      isActive
                        ? "border-blue-200 bg-blue-50 shadow-sm"
                        : "border-transparent bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="shrink-0">
                        {result.status === "passed" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        )}
                        {result.status === "failed" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                        {result.status === "blocked" && (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        {result.status === "not-executed" && (
                          <div className="h-3 w-3 rounded-full border-2 border-slate-300" />
                        )}
                      </div>
                      <div className="truncate text-xs font-semibold text-[#1E293B]">
                        {test?.title || "Unknown Test"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* execution Display */}
        <main className="custom-scrollbar flex-1 overflow-y-auto bg-[#F8FAFC] p-4 md:p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {currentResult && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="h-5 border-blue-200 bg-blue-50 px-1.5 text-[10px] font-bold text-blue-700"
                    >
                      {currentTest?.artifact_key || `TC-${String(currentResult.testId).slice(0, 8)}`}
                    </Badge>
                  </div>
                  <h2 className="text-2xl font-bold leading-tight tracking-tight text-[#1E293B]">
                    {currentTest?.title || `Test (${String(currentResult.testId).slice(0, 8)}…)`}
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#64748B]">
                    {currentTest?.description ?? ""}
                  </p>
                </div>

                <Card className="overflow-hidden border-[#E2E8F0] bg-white shadow-sm">
                  <CardHeader className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-xs font-bold text-[#475569]">
                      <Layout className="h-3.5 w-3.5" /> TEST STEPS
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ExecutionStepList
                      steps={currentTestSteps}
                      results={currentResult?.stepResults || []}
                      onUpdateStep={handleStepUpdate}
                      onCopyBugReport={handleCopyBugReport}
                      onPassAllSteps={handlePassAllSteps}
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Footer Nav */}
      <footer className="z-10 flex h-14 shrink-0 items-center justify-between border-t border-[#E2E8F0] bg-white px-6 shadow-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={currentTestIndex === 0}
          className="h-8 border-[#E2E8F0] text-xs text-[#64748B] hover:bg-slate-50"
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Prev
        </Button>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
          {currentTestIndex + 1} / {testExecutionResults.length}
        </div>

        {currentTestIndex === testExecutionResults.length - 1 ? (
          <Button
            size="sm"
            onClick={handleSaveAndExit}
            className="h-8 bg-green-600 px-6 text-xs text-white shadow-sm hover:bg-green-700"
          >
            Complete Run
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleNext}
            className="h-8 bg-[#1E293B] px-6 text-xs text-white hover:bg-slate-800"
          >
            Next
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}</style>
    </div>
  );
}
