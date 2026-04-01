import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layout,
  ArrowLeft,
  Clock,
  ListChecks,
  Save,
  Flag,
  Link2,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "../../../shared/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui/select";
import { useArtifact, useUpdateArtifact, useArtifacts } from "../../../shared/api/artifactApi";
import { sortOutgoingRelationships, useArtifactRelationships } from "../../../shared/api/relationshipApi";
import {
  resolveExecutionConfig,
  type ResolvedExecutionConfigResponse,
} from "../../../shared/api/qualityExecutionConfigApi";
import { ExecutionStepList } from "./ExecutionStepList";
import type { TestStep, StepResult } from "../types";
import {
  parseRunMetricsPayload,
  stringifyRunMetricsPayload,
  type TestExecutionResultRow,
} from "../lib/runMetrics";
import { parseTestSteps } from "../lib/testSteps";
import { parseTestParams, rowLabelForIndex } from "../lib/testParams";
import { toast } from "sonner";
import { useAuthStore } from "../../../shared/stores/authStore";
import { hasPermission } from "../../../shared/utils/permissions";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { qualityRunExecuteAbsoluteUrl } from "../lib/qualityRunPaths";
import { buildBugReportMarkdown } from "../lib/bugReportMarkdown";
import { findRootDefectId, pickDefectArtifactType } from "../lib/defectManifestHelpers";
import {
  CreateDefectFromExecutionDialog,
  type DefectCreatedPayload,
} from "./CreateDefectFromExecutionDialog";

function mergeUniqueStrings(...values: Array<string[] | undefined>): string[] | undefined {
  const merged = values.flatMap((items) => items ?? []).filter((item) => item.length > 0);
  if (merged.length === 0) return undefined;
  return Array.from(new Set(merged));
}

function buildStepResultFromStep(step: TestStep): StepResult {
  return {
    stepId: String(step.id),
    status: "not-executed",
    expectedResultSnapshot: step.expectedResult,
    stepNameSnapshot: step.name,
    stepNumber: step.stepNumber,
  };
}

function mergeSavedExecution(
  saved: TestExecutionResultRow | undefined,
  testId: string,
  expanded: TestStep[],
): TestExecutionResultRow {
  const carryParams = (base: TestExecutionResultRow): TestExecutionResultRow => ({
    ...base,
    configurationId: saved?.configurationId ?? null,
    configurationName: saved?.configurationName ?? null,
    configurationSnapshot: saved?.configurationSnapshot ?? null,
    resolvedValues: saved?.resolvedValues ?? saved?.paramValuesUsed,
    paramRowIndex: saved?.paramRowIndex,
    paramValuesUsed: saved?.paramValuesUsed ?? saved?.resolvedValues,
  });

  if (expanded.length === 0 && saved) {
    return saved;
  }
  if (!saved) {
    return {
      testId,
      status: "not-executed",
      stepResults: expanded.map((step) => buildStepResultFromStep(step)),
      expandedStepsSnapshot: expanded,
    };
  }
  if (
    saved.stepResults.length === expanded.length &&
    saved.stepResults.every((r, i) => r.stepId === String(expanded[i]?.id))
  ) {
    return carryParams({ ...saved, expandedStepsSnapshot: expanded });
  }
  const snap = saved.expandedStepsSnapshot;
  if (
    snap &&
    saved.stepResults.length === snap.length &&
    saved.stepResults.every((r, i) => r.stepId === snap[i]?.id)
  ) {
    return carryParams({ ...saved, expandedStepsSnapshot: snap });
  }
  return carryParams({
    testId,
    status: "not-executed",
    stepResults: expanded.map((step) => buildStepResultFromStep(step)),
    expandedStepsSnapshot: expanded,
  });
}

interface ManualExecutionPlayerCoreProps {
  orgSlug: string;
  /** Project UUID for API calls. */
  projectSlug: string;
  /** Project slug from the URL (for share links and navigation). */
  executePathProjectSlug: string;
  runId: string;
  onExit: () => void;
  onSave?: () => void;
  fullScreen?: boolean;
  layout?: "default" | "popout";
  deepLinkTestId?: string;
  deepLinkStepId?: string;
}

export function ManualExecutionPlayerCore({
  orgSlug,
  projectSlug,
  executePathProjectSlug,
  runId,
  onExit,
  onSave,
  fullScreen = false,
  layout = "default",
  deepLinkTestId,
  deepLinkStepId,
}: ManualExecutionPlayerCoreProps) {
  const { t } = useTranslation("quality");
  const queryClient = useQueryClient();
  // Data fetching
  const { data: run, isLoading: runLoading } = useArtifact(orgSlug, projectSlug, runId);
  const { data: runLinks = [], isLoading: linksLoading } = useArtifactRelationships(
    orgSlug,
    projectSlug,
    runId,
  );

  const suiteId = useMemo(
    () =>
      runLinks.find(
        (relationship) =>
          relationship.relationship_type === "run_for_suite" && relationship.direction === "outgoing",
      )?.target_artifact_id,
    [runLinks],
  );

  const { data: suiteLinks = [], isLoading: suiteLinksLoading } = useArtifactRelationships(
    orgSlug,
    projectSlug,
    suiteId,
  );

  const linkedTestIds = useMemo(() => {
    const fromSuite = suiteId
      ? sortOutgoingRelationships(suiteLinks, suiteId, "suite_includes_test").map(
          (relationship) => relationship.target_artifact_id,
        )
      : [];
    if (fromSuite.length > 0) return fromSuite;
    return runLinks
      .filter((relationship) => relationship.direction === "outgoing")
      .map((relationship) => relationship.target_artifact_id);
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
  const { data: manifestData } = useProjectManifest(orgSlug, projectSlug);
  const { data: defectRootsData, isPending: defectRootsPending } = useArtifacts(
    orgSlug,
    projectSlug,
    undefined,
    undefined,
    "updated_at",
    "desc",
    undefined,
    80,
    0,
    false,
    undefined,
    undefined,
    undefined,
    "defect",
    true,
  );
  const permissions = useAuthStore((s) => s.permissions);
  const canCreateDefect = hasPermission(permissions, "artifact:create");
  const canUpdateArtifacts = hasPermission(permissions, "artifact:update");

  const rootDefectId = useMemo(
    () => findRootDefectId(defectRootsData?.items),
    [defectRootsData?.items],
  );
  const defectArtifactType = useMemo(
    () => pickDefectArtifactType(manifestData?.manifest_bundle),
    [manifestData?.manifest_bundle],
  );

  // Local state for the execution session
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [testExecutionResults, setTestExecutionResults] = useState<TestExecutionResultRow[]>([]);
  const [resolvedConfigByTestId, setResolvedConfigByTestId] = useState<Record<string, ResolvedExecutionConfigResponse>>({});
  const [selectedConfigurationIdByTestId, setSelectedConfigurationIdByTestId] = useState<Record<string, string | null>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [defectDialog, setDefectDialog] = useState<{
    step: TestStep;
    stepResult: StepResult;
  } | null>(null);

  const appliedTestDeepLink = useRef(false);
  const scrolledToStepRef = useRef<string | null>(null);
  const deepLinkStepInvalidToastRef = useRef(false);

  useEffect(() => {
    appliedTestDeepLink.current = false;
    scrolledToStepRef.current = null;
    deepLinkStepInvalidToastRef.current = false;
  }, [runId, deepLinkTestId, deepLinkStepId]);

  const isPopout = layout === "popout";
  const showDefectRootUnavailable =
    canCreateDefect && !defectRootsPending && !rootDefectId;

  const testsById = useMemo(
    () => new Map((testsData?.items ?? []).map((t) => [t.id, t])),
    [testsData?.items],
  );

  const activeTests = useMemo(() => {
    return linkedTestIds
      .map((id) => testsById.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);
  }, [linkedTestIds, testsById]);

  // Initialize results from run and select a stable configuration id when available.
  useEffect(() => {
    if (!run || isInitialized) return;
    if (runLoading || linksLoading || testsLoading) return;
    if (suiteId && suiteLinksLoading) return;
    const saved = parseRunMetricsPayload(run.custom_fields?.run_metrics_json);
    const selections: Record<string, string | null> = {};
    const initialResults =
      activeTests.length > 0
        ? activeTests.map((test) => {
            const savedRow = saved?.find((s) => s.testId === test.id);
            const doc = parseTestParams(test.custom_fields?.test_params_json);
            const defaultConfigId =
              savedRow?.configurationId ??
              doc?.rows?.find((row) => row.isDefault)?.id ??
              doc?.rows?.[0]?.id ??
              null;
            selections[test.id] = defaultConfigId;
            return mergeSavedExecution(savedRow, test.id, parseTestSteps(test.custom_fields?.test_steps_json));
          })
        : (saved ?? []);
    queueMicrotask(() => {
      setSelectedConfigurationIdByTestId(selections);
      setTestExecutionResults(initialResults);
      setCurrentTestIndex(0);
      setIsInitialized(true);
    });
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

  const resolvedTestIndex = useMemo(() => {
    const len = testExecutionResults.length;
    if (len === 0) return 0;
    if (currentTestIndex < 0 || currentTestIndex >= len) return 0;
    return currentTestIndex;
  }, [testExecutionResults.length, currentTestIndex]);

  const currentResult = testExecutionResults[resolvedTestIndex];
  const currentTest = activeTests.find((t) => t.id === currentResult?.testId);
  const currentTestId = currentTest?.id ?? null;
  const currentResolvedConfig = currentTest ? resolvedConfigByTestId[currentTest.id] : undefined;
  const currentResolvedSteps = currentResolvedConfig?.steps ?? null;
  const currentTestStepsJson = currentTest?.custom_fields?.test_steps_json;
  const currentTestStepsKey =
    typeof currentTestStepsJson === "string"
      ? currentTestStepsJson
      : JSON.stringify(currentTestStepsJson ?? null);
  const currentTestSteps = currentResolvedSteps?.length
    ? currentResolvedSteps.map((step) => ({
        id: step.id,
        stepNumber: step.step_number,
        name: step.name,
        description: step.description,
        expectedResult: step.expected_result,
        status: step.status,
      }))
    : currentTestStepsJson
      ? parseTestSteps(currentTestStepsJson)
      : [];

  const currentParamDoc = currentTest
    ? parseTestParams(currentTest.custom_fields?.test_params_json)
    : null;

  useEffect(() => {
    if (!isInitialized || !currentTestId) return;
    let cancelled = false;
    void resolveExecutionConfig(
      orgSlug,
      projectSlug,
      runId,
      currentTestId,
      selectedConfigurationIdByTestId[currentTestId] ?? null,
    )
      .then((resolved) => {
        if (cancelled) return;
        setResolvedConfigByTestId((prev) => ({ ...prev, [currentTestId]: resolved }));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const detail =
          (error as { body?: { detail?: string }; detail?: string; message?: string })?.body?.detail ??
          (error as { detail?: string; message?: string })?.detail ??
          (error as { message?: string })?.message ??
          "Could not resolve execution configuration.";
        toast.error(detail);
      });
    return () => {
      cancelled = true;
    };
  }, [isInitialized, currentTestId, orgSlug, projectSlug, runId, selectedConfigurationIdByTestId]);

  useEffect(() => {
    if (!isInitialized || appliedTestDeepLink.current) return;
    let tid = deepLinkTestId?.trim();
    const sid = deepLinkStepId?.trim();
    if (!tid && sid) {
      for (const [testId, resolved] of Object.entries(resolvedConfigByTestId)) {
        if (resolved.steps.some((s) => String(s.id) === sid)) {
          tid = testId;
          break;
        }
      }
    }
    if (!tid) {
      appliedTestDeepLink.current = true;
      return;
    }
    const idx = testExecutionResults.findIndex((r) => r.testId === tid);
    if (idx < 0) {
      toast.error(t("execution.deepLinkInvalidTest"));
    } else {
      queueMicrotask(() => {
        setCurrentTestIndex(idx);
      });
    }
    appliedTestDeepLink.current = true;
  }, [
    isInitialized,
    deepLinkTestId,
    deepLinkStepId,
    activeTests,
    testExecutionResults,
    resolvedConfigByTestId,
    t,
  ]);

  useEffect(() => {
    const sid = deepLinkStepId?.trim();
    if (!sid || !isInitialized || !currentTestId) return;
    if (deepLinkTestId?.trim() && currentTestId !== deepLinkTestId.trim()) return;
    const effectSteps = currentResolvedSteps?.length
      ? currentResolvedSteps.map((step) => ({
          id: step.id,
          stepNumber: step.step_number,
          name: step.name,
          description: step.description,
          expectedResult: step.expected_result,
          status: step.status,
        }))
      : currentTestStepsJson
        ? parseTestSteps(currentTestStepsJson)
        : [];
    const exists = effectSteps.some((s) => String(s.id) === sid);
    if (!exists) {
      if (!deepLinkStepInvalidToastRef.current) {
        deepLinkStepInvalidToastRef.current = true;
        toast.error(t("execution.deepLinkInvalidStep"));
      }
      scrolledToStepRef.current = sid;
      return;
    }
    if (scrolledToStepRef.current === sid) return;
    scrolledToStepRef.current = sid;
    const tmr = window.setTimeout(() => {
      document.getElementById(`execution-step-${sid}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
    return () => clearTimeout(tmr);
  }, [
    isInitialized,
    currentTestId,
    deepLinkStepId,
    deepLinkTestId,
    currentResolvedSteps,
    currentTestStepsJson,
    currentTestStepsKey,
    t,
  ]);

  const defectFormDefaults = (() => {
    if (!defectDialog || !currentTest || !run) return null;
    return {
      title: `${run.title ?? "Run"} — Step ${defectDialog.step.stepNumber}`,
      description: buildBugReportMarkdown({
        test: currentTest,
        run,
        step: defectDialog.step,
        stepResult: defectDialog.stepResult,
      }),
    };
  })();

  // Handlers
  const handleStepUpdate = (
    stepId: string,
    status: StepResult["status"],
    actualResult?: string,
    notes?: string,
  ) => {
    const newResults = [...testExecutionResults];
    const testResult = newResults[resolvedTestIndex];
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
        linkedDefectIds: existing.linkedDefectIds,
        attachmentIds: existing.attachmentIds,
        attachmentNames: existing.attachmentNames,
        lastEvidenceAt: existing.lastEvidenceAt ?? null,
        expectedResultSnapshot:
          existing.expectedResultSnapshot ??
          currentTestSteps.find((step) => String(step.id) === stepId)?.expectedResult,
        stepNameSnapshot:
          existing.stepNameSnapshot ??
          currentTestSteps.find((step) => String(step.id) === stepId)?.name,
        stepNumber:
          existing.stepNumber ??
          currentTestSteps.find((step) => String(step.id) === stepId)?.stepNumber,
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

  const handleDefectCreated = useCallback(
    (payload: DefectCreatedPayload) => {
      if (!defectDialog) return;
      let nextResults: TestExecutionResultRow[] = [];
      setTestExecutionResults((prev) => {
        nextResults = prev.map((row, rowIndex) => {
          if (rowIndex !== resolvedTestIndex) return row;
          return {
            ...row,
            stepResults: row.stepResults.map((stepResult) => {
              if (stepResult.stepId !== String(defectDialog.step.id)) return stepResult;
              return {
                ...stepResult,
                status: payload.executionContext.step_status === "blocked" ? "blocked" : "failed",
                linkedDefectIds: mergeUniqueStrings(stepResult.linkedDefectIds, [payload.defectId]),
                attachmentIds: mergeUniqueStrings(stepResult.attachmentIds, payload.runAttachmentIds),
                attachmentNames: mergeUniqueStrings(stepResult.attachmentNames, payload.runAttachmentNames),
                lastEvidenceAt:
                  payload.runAttachmentIds.length > 0 ? new Date().toISOString() : stepResult.lastEvidenceAt ?? null,
                expectedResultSnapshot:
                  stepResult.expectedResultSnapshot ?? defectDialog.step.expectedResult,
                stepNameSnapshot: stepResult.stepNameSnapshot ?? defectDialog.step.name,
                stepNumber: stepResult.stepNumber ?? defectDialog.step.stepNumber,
              };
            }),
          };
        });
        return nextResults;
      });
      if (run && nextResults.length > 0) {
        void updateRunMutation.mutateAsync({
          custom_fields: {
            ...run.custom_fields,
            run_metrics_json: stringifyRunMetricsPayload(nextResults),
          },
        });
      }
      void queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectSlug, "artifacts", runId, "attachments"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectSlug, "artifacts", runId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectSlug, "artifacts"],
      });
      toast.success(
        t("execution.defect.runnerLinkedSuccess", {
          step: defectDialog.step.stepNumber,
        }),
      );
    },
    [defectDialog, orgSlug, projectSlug, queryClient, resolvedTestIndex, run, runId, t, updateRunMutation],
  );

  const handleCopyBugReport = (step: TestStep, stepResult: StepResult) => {
    if (!currentTest || !run) return;
    const md = buildBugReportMarkdown({
      test: currentTest,
      run,
      step,
      stepResult,
    });
    void navigator.clipboard.writeText(md);
    toast.success(t("execution.bugReportCopied", { step: step.stepNumber }));
  };

  const handleCopyExecuteLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = qualityRunExecuteAbsoluteUrl(origin, orgSlug, executePathProjectSlug, runId, {
      test: currentTestId ?? undefined,
    });
    void navigator.clipboard.writeText(url);
    toast.success(t("execution.linkCopied"));
  };

  const handlePassAllSteps = () => {
    if (!currentResult) return;
    if (!currentTest) {
      toast.error("Test case not loaded");
      return;
    }

    const steps = currentTestSteps;

    const updatedStepResults = steps.map((step) => {
      const existing = currentResult.stepResults.find((r) => r.stepId === String(step.id));
      return {
        stepId: String(step.id),
        status: "passed" as const,
        actualResult: existing?.actualResult || "As expected",
        notes: existing?.notes || "",
        linkedDefectIds: existing?.linkedDefectIds,
        attachmentIds: existing?.attachmentIds,
        attachmentNames: existing?.attachmentNames,
        lastEvidenceAt: existing?.lastEvidenceAt ?? null,
        expectedResultSnapshot: existing?.expectedResultSnapshot ?? step.expectedResult,
        stepNameSnapshot: existing?.stepNameSnapshot ?? step.name,
        stepNumber: existing?.stepNumber ?? step.stepNumber,
      };
    });

    const newResults = [...testExecutionResults];
    newResults[resolvedTestIndex] = {
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
      const resultsWithSnapshots: TestExecutionResultRow[] = [];
      for (const r of testExecutionResults) {
        const test = activeTests.find((x) => x.id === r.testId);
        if (!test) {
          resultsWithSnapshots.push(r);
          continue;
        }
        const resolved = await resolveExecutionConfig(
          orgSlug,
          projectSlug,
          runId,
          test.id,
          selectedConfigurationIdByTestId[test.id] ?? null,
        );
        if (resolved.unresolved_params.length > 0) {
          toast.error(t("execution.unresolvedParams", { names: resolved.unresolved_params.join(", ") }));
          return;
        }
        const configurationSnapshot = (() => {
          if (!resolved.configuration_id) return null;
          const doc = parseTestParams(test.custom_fields?.test_params_json);
          return doc?.rows?.find((row) => row.id === resolved.configuration_id) ?? null;
        })();
        resultsWithSnapshots.push({
          ...r,
          configurationId: resolved.configuration_id,
          configurationName: resolved.configuration_name,
          configurationSnapshot,
          resolvedValues: resolved.resolved_values,
          paramValuesUsed: resolved.resolved_values,
          expandedStepsSnapshot: resolved.steps.map((step) => ({
            id: step.id,
            stepNumber: step.step_number,
            name: step.name,
            description: step.description,
            expectedResult: step.expected_result,
            status: step.status,
          })),
        });
      }
      await updateRunMutation.mutateAsync({
        custom_fields: {
          ...run.custom_fields,
          run_metrics_json: stringifyRunMetricsPayload(resultsWithSnapshots),
        },
      });

      void queryClient.invalidateQueries({ queryKey: ["qualityLastExec"] });

      toast.success("Execution progress saved");
      if (onSave) onSave();
      onExit();
    } catch {
      toast.error("Failed to save progress");
    }
  };

  const handleNext = () => {
    if (resolvedTestIndex < testExecutionResults.length - 1) {
      setCurrentTestIndex(resolvedTestIndex + 1);
    }
  };

  const handlePrev = () => {
    if (resolvedTestIndex > 0) {
      setCurrentTestIndex(resolvedTestIndex - 1);
    }
  };

  // Loading state
  const isLoading = runLoading || linksLoading || testsLoading || (!!suiteId && suiteLinksLoading);
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background/50 backdrop-blur-sm">
        <div
          className="flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-xl" />
          <span className="animate-pulse text-sm font-medium text-muted-foreground">
            {t("execution.loadingSession")}
          </span>
        </div>
      </div>
    );
  }

  // Handle missing run immediately
  if (!run) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card
          role="alert"
          className="max-w-md border-destructive/20 bg-destructive/5 text-center shadow-xl"
        >
          <CardHeader>
            <AlertCircle className="mx-auto mb-2 size-12 text-destructive" aria-hidden />
            <CardTitle className="text-destructive">{t("execution.runNotFoundTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("execution.runNotFoundDescription")}</p>
            <Button onClick={onExit} variant="outline" className="mt-6">
              {t("execution.returnToProject")}
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
        <div className="flex flex-col items-center gap-2" role="status" aria-live="polite">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs text-muted-foreground">{t("execution.preparingTestData")}</span>
        </div>
      </div>
    );
  }

  if (activeTests.length === 0 && testExecutionResults.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md text-center shadow-lg">
          <CardHeader>
            <Flag className="mx-auto mb-2 size-12 text-muted-foreground" aria-hidden />
            <CardTitle>{t("execution.noTestsLinkedTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("execution.noTestsLinkedDescription")}</p>
            <Button onClick={onExit} variant="outline" className="mt-6">
              {t("execution.closePlayer")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercentage = testExecutionResults.length > 0
    ? (testExecutionResults.filter((r) => r.status !== "not-executed").length / testExecutionResults.length) * 100
    : 0;

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-[#F8FAFC] ${fullScreen ? "fixed inset-0 z-50" : "relative"}`}
      data-testid={isPopout ? "quality-exec-popout" : undefined}
    >
      {/* Header */}
      <header
        className={`z-10 flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white shadow-sm transition-all ${
          isPopout ? "h-12 px-3" : "h-14 px-6"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="min-h-9 shrink-0 text-[#64748B] hover:text-[#1E293B]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {fullScreen ? "Exit" : "Close"}
          </Button>
          <div className="hidden h-6 w-px bg-[#E2E8F0] sm:block" />
          <h1 className="flex min-w-0 items-center gap-2 truncate font-bold text-[#1E293B] max-w-[200px] md:max-w-md">
            <ListChecks className="h-3.5 w-3.5 shrink-0 text-[#64748B]" aria-hidden />
            <span className="truncate">{run.title}</span>
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
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
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={handleCopyExecuteLink}
            title={t("execution.copyLinkTitle")}
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("execution.copyLink")}</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAndExit}
            disabled={updateRunMutation.isPending}
            className="min-h-9 bg-blue-600 shadow-sm hover:bg-blue-700"
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </header>

      {isPopout ? (
        <p className="shrink-0 border-b border-[#E2E8F0] bg-slate-50 px-3 py-1.5 text-center text-[10px] leading-snug text-[#64748B]">
          {t("execution.popoutHint")}
        </p>
      ) : null}

      {showDefectRootUnavailable ? (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <span>{t("execution.defect.rootUnavailableBanner")}</span>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Test List Sidebar */}
        <aside
          className={`hidden flex-col border-r border-[#E2E8F0] bg-white shadow-sm lg:flex ${
            isPopout ? "w-56" : "w-72"
          }`}
        >
          <div
            className={`space-y-3 border-b border-[#E2E8F0] bg-slate-50/50 ${isPopout ? "p-3" : "p-5"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                Progress
              </span>
              <span className="text-[10px] font-bold text-blue-600">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <progress
              className="h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-[#E2E8F0] [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600"
              max={100}
              value={progressPercentage}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {testExecutionResults.map((result, index) => {
                const test = activeTests.find((t) => t.id === result.testId);
                const isActive = index === resolvedTestIndex;

                return (
                  <button
                    key={result.testId}
                    type="button"
                    onClick={() => setCurrentTestIndex(index)}
                    className={`min-h-11 w-full rounded-lg border text-left transition-all ${
                      isPopout ? "p-2" : "p-2.5"
                    } ${
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
        <main
          className={`min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] ${
            isPopout ? "p-2 md:p-3" : "p-4 md:p-6"
          }`}
        >
          <div
            className={`mx-auto ${isPopout ? "max-w-full space-y-3" : "max-w-3xl space-y-6"}`}
          >
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
                  <h2
                    className={`font-bold leading-tight tracking-tight text-[#1E293B] ${
                      isPopout ? "text-xl" : "text-2xl"
                    }`}
                  >
                    {currentTest?.title || `Test (${String(currentResult.testId).slice(0, 8)}…)`}
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#64748B]">
                    {currentTest?.description ?? ""}
                  </p>
                  {currentTest && currentParamDoc?.rows && currentParamDoc.rows.length > 0 ? (
                    <div className="flex flex-col gap-1.5 rounded-md border border-[#E2E8F0] bg-white p-3">
                      <span className="text-xs font-semibold text-[#475569]">{t("execution.dataRow")}</span>
                      <Select
                        value={selectedConfigurationIdByTestId[currentTest.id] ?? ""}
                        onValueChange={(v) => {
                          setSelectedConfigurationIdByTestId((prev) => ({
                            ...prev,
                            [currentTest.id]: v || null,
                          }));
                        }}
                      >
                        <SelectTrigger
                          className="h-9 w-full max-w-md border-[#E2E8F0] text-sm"
                          data-testid="quality-exec-param-row-select"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(currentResolvedConfig?.available_configurations.length
                            ? currentResolvedConfig.available_configurations
                            : currentParamDoc.rows.map((row, i) => ({
                                id: row.id,
                                name: row.name ?? row.label ?? rowLabelForIndex(currentParamDoc, i),
                                is_default: row.isDefault ?? false,
                              }))).map((row, i) => (
                            <SelectItem key={row.id ?? i} value={row.id}>
                              {row.name ?? rowLabelForIndex(currentParamDoc, i)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-[#94A3B8]">{t("execution.dataRowHint")}</p>
                    </div>
                  ) : null}
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
                      layoutCompact={isPopout}
                      onOpenCreateDefect={
                        canCreateDefect && rootDefectId
                          ? (step, stepResult) => setDefectDialog({ step, stepResult })
                          : undefined
                      }
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Footer Nav */}
      <footer
        className={`z-10 flex shrink-0 items-center justify-between border-t border-[#E2E8F0] bg-white shadow-sm ${
          isPopout ? "h-12 px-3" : "h-14 px-6"
        }`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={resolvedTestIndex === 0}
          className="min-h-9 border-[#E2E8F0] text-xs text-[#64748B] hover:bg-slate-50"
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Prev
        </Button>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
          {resolvedTestIndex + 1} / {testExecutionResults.length}
        </div>

        {resolvedTestIndex === testExecutionResults.length - 1 ? (
          <Button
            size="sm"
            onClick={handleSaveAndExit}
            className="min-h-9 bg-green-600 px-6 text-xs text-white shadow-sm hover:bg-green-700"
          >
            Complete Run
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleNext}
            className="min-h-9 bg-[#1E293B] px-6 text-xs text-white hover:bg-slate-800"
          >
            Next
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </footer>

      {defectFormDefaults && defectDialog && currentTest?.id ? (
        <CreateDefectFromExecutionDialog
          open
          onOpenChange={(open) => {
            if (!open) setDefectDialog(null);
          }}
          orgSlug={orgSlug}
          projectId={projectSlug}
          projectSlug={executePathProjectSlug}
          runId={runId}
          testCaseId={currentTest.id}
          defectParentId={rootDefectId}
          defectArtifactType={defectArtifactType}
          defaultTitle={defectFormDefaults.title}
          defaultDescription={defectFormDefaults.description}
          canCreateArtifact={canCreateDefect}
          canUpdateArtifact={canUpdateArtifacts}
          stepContext={{
            stepId: String(defectDialog.step.id),
            stepName: defectDialog.step.name,
            stepNumber: defectDialog.step.stepNumber,
            stepStatus: defectDialog.stepResult.status,
            actualResult: defectDialog.stepResult.actualResult,
            notes: defectDialog.stepResult.notes,
            expectedResult: defectDialog.step.expectedResult,
          }}
          manualRunnerMode
          onCreated={handleDefectCreated}
        />
      ) : null}

    </div>
  );
}
