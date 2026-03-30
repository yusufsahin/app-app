import { useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../../shared/components/ui/utils";
import { Badge, Button, Tabs, TabsList, TabsTrigger } from "../../../shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../shared/components/ui/dialog";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import { useArtifact } from "../../../shared/api/artifactApi";
import { formatRunEnvironmentLabel, summarizeRunMetricsFromCustomFields } from "../lib/runMetrics";
import { ManualExecutionPlayerCore } from "./ManualExecutionPlayerCore";
import { isArtifactUuid } from "../lib/qualityRunPaths";

type RunModalView = "overview" | "execution";

function toRunModalView(value: string | null): RunModalView {
  return value === "execution" ? "execution" : "overview";
}

function getPrimaryActionForRunState(state: string | null | undefined): "continue" | "rerun" | "start" | "details" {
  const normalized = (state ?? "").trim().toLowerCase();
  if (!normalized) return "details";
  if (["queued", "in_progress", "paused"].includes(normalized)) return "continue";
  if (["failed", "completed", "cancelled"].includes(normalized)) return "rerun";
  if (["draft", "not_started"].includes(normalized)) return "start";
  return "details";
}

/**
 * Full manual runner as an in-app modal. Opened when URL search contains `runExecute=<run artifact id>`
 * (optional `runTest`, `runStep` for deep links). Mount under AppLayout for any project route.
 */
export function ManualExecutionModalHost() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project } = useArtifactsPageProject();

  const runExecute = searchParams.get("runExecute")?.trim() ?? "";
  const runViewRaw = searchParams.get("runView");
  const runView = toRunModalView(runViewRaw);
  const runTest = searchParams.get("runTest")?.trim() || undefined;
  const runStep = searchParams.get("runStep")?.trim() || undefined;

  const open = Boolean(
    orgSlug &&
      projectSlug &&
      project?.id &&
      runExecute &&
      isArtifactUuid(runExecute),
  );

  const stripExecutionParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("runExecute");
        n.delete("runView");
        n.delete("runTest");
        n.delete("runStep");
        return n;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (runExecute && !isArtifactUuid(runExecute)) {
      stripExecutionParams();
    }
  }, [runExecute, stripExecutionParams]);

  useEffect(() => {
    if (runExecute && runViewRaw && runViewRaw !== "overview" && runViewRaw !== "execution") {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("runView", "overview");
          return n;
        },
        { replace: true },
      );
    }
  }, [runExecute, runViewRaw, setSearchParams]);

  const handleExit = useCallback(() => {
    stripExecutionParams();
  }, [stripExecutionParams]);

  const setRunView = useCallback(
    (view: RunModalView) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("runView", view);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const runQuery = useArtifact(orgSlug, project?.id, open ? runExecute : undefined);

  const modalKey = useMemo(
    () => (open ? `${orgSlug}:${project!.id}:${runExecute}:${runTest ?? ""}:${runStep ?? ""}:${runView}` : "closed"),
    [open, orgSlug, project, runExecute, runTest, runStep, runView],
  );

  if (!orgSlug || !projectSlug) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) stripExecutionParams();
      }}
    >
      <DialogContent
        data-testid="quality-manual-execution-modal"
        className={cn(
          "flex h-[min(90dvh,920px)] w-[min(96vw,1200px)] max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden border-0 p-0 sm:max-w-none",
          "[&>button]:hidden",
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t("execution.modalTitle")}</DialogTitle>
        {open && project?.id ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="border-b border-border/60 bg-background px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">
                    {runQuery.data?.title || t("runsHub.modalFallbackRunTitle")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t("runsHub.modalRunId", { id: runExecute })}</span>
                    {runQuery.data?.state ? <Badge variant="outline">{runQuery.data.state}</Badge> : null}
                    <span>
                      {t("runsHub.colEnvironment")}:{" "}
                      {formatRunEnvironmentLabel(runQuery.data?.custom_fields as Record<string, unknown> | undefined)}
                    </span>
                  </div>
                </div>
                <Tabs value={runView} onValueChange={(next) => setRunView(next as RunModalView)}>
                  <TabsList>
                    <TabsTrigger value="overview">{t("runsHub.modalOverviewTab")}</TabsTrigger>
                    <TabsTrigger value="execution">{t("runsHub.modalExecutionTab")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {runView === "overview" ? (
              <div className="h-full overflow-auto p-4" data-testid="quality-run-overview-panel">
                {runQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">{t("runsHub.modalLoadingRun")}</p>
                ) : runQuery.isError || !runQuery.data ? (
                  <p className="text-sm text-muted-foreground">{t("runsHub.modalRunUnavailable")}</p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{runQuery.data.description || "—"}</p>
                    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      {(() => {
                        const summary = summarizeRunMetricsFromCustomFields(
                          runQuery.data.custom_fields as Record<string, unknown> | undefined,
                        );
                        return (
                          <>
                            <div className="rounded-md border px-3 py-2">{t("runsHub.modalPassed", { count: summary.passed })}</div>
                            <div className="rounded-md border px-3 py-2">{t("runsHub.modalFailed", { count: summary.failed })}</div>
                            <div className="rounded-md border px-3 py-2">{t("runsHub.modalBlocked", { count: summary.blocked })}</div>
                            <div className="rounded-md border px-3 py-2">
                              {t("runsHub.modalNotRun", { count: summary.notExecuted })}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const action = getPrimaryActionForRunState(runQuery.data.state);
                        if (action === "details") {
                          return (
                            <Button type="button" onClick={() => setRunView("execution")}>
                              {t("runsHub.modalOpenExecution")}
                            </Button>
                          );
                        }
                        const labelKey =
                          action === "continue"
                            ? "runsHub.modalContinueRun"
                            : action === "rerun"
                              ? "runsHub.modalRerun"
                              : "runsHub.modalStartRun";
                        return (
                          <Button type="button" onClick={() => setRunView("execution")}>
                            {t(labelKey)}
                          </Button>
                        );
                      })()}
                      <Button type="button" variant="outline" onClick={handleExit}>
                        {t("common.close")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ManualExecutionPlayerCore
                key={modalKey}
                orgSlug={orgSlug}
                projectSlug={project.id}
                executePathProjectSlug={projectSlug}
                runId={runExecute}
                onExit={handleExit}
                fullScreen={false}
                layout="default"
                deepLinkTestId={runTest}
                deepLinkStepId={runStep}
              />
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
