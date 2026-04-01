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
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import { useArtifact } from "../../../shared/api/artifactApi";
import { formatRunEnvironmentLabel } from "../lib/runMetrics";
import {
  RUN_MODAL_TABS,
  RUN_OVERVIEW_TABS,
  parseRunOverviewTabParam,
  type RunOverviewTab,
} from "../lib/qualityOpenManualRunner";

const RUN_MODAL_TAB_STRINGS = new Set<string>(RUN_MODAL_TABS);
import { ManualExecutionPlayerCore } from "./ManualExecutionPlayerCore";
import { QualityRunOverviewBody } from "./QualityRunOverviewBody";
import { isArtifactUuid } from "../lib/qualityRunPaths";

type RunModalView = "overview" | "execution";

function toRunModalView(value: string | null): RunModalView {
  return value === "execution" ? "execution" : "overview";
}

/**
 * Full manual runner as an in-app modal. Opened when URL search contains `runExecute=<run artifact id>`
 * (optional `runTest`, `runStep` for deep links). Mount under AppLayout for any project route.
 */
export function ManualExecutionModalHost() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project } = useBacklogWorkspaceProject();

  const runExecute = searchParams.get("runExecute")?.trim() ?? "";
  const runViewRaw = searchParams.get("runView");
  const runTabParam = searchParams.get("runTab")?.trim() || null;
  const runTest = searchParams.get("runTest")?.trim() || undefined;
  const runStep = searchParams.get("runStep")?.trim() || undefined;
  const runOverviewTabRaw = searchParams.get("runOverviewTab");

  const runView: RunModalView =
    toRunModalView(runViewRaw) === "execution" || runTabParam === "runner" ? "execution" : "overview";

  const overviewTabSource =
    runView === "overview" && runTabParam && runTabParam !== "runner"
      ? runTabParam
      : runOverviewTabRaw;
  const overviewTab = parseRunOverviewTabParam(overviewTabSource);

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
        n.delete("runOverviewTab");
        n.delete("runTab");
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

  useEffect(() => {
    const raw = searchParams.get("runOverviewTab");
    if (raw && !(RUN_OVERVIEW_TABS as readonly string[]).includes(raw)) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("runOverviewTab");
          return n;
        },
        { replace: true },
      );
    }
  }, [runExecute, searchParams, setSearchParams]);

  useEffect(() => {
    const raw = searchParams.get("runTab");
    if (raw && !RUN_MODAL_TAB_STRINGS.has(raw)) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("runTab");
          return n;
        },
        { replace: true },
      );
    }
  }, [runExecute, searchParams, setSearchParams]);

  const handleExit = useCallback(() => {
    stripExecutionParams();
  }, [stripExecutionParams]);

  const setRunView = useCallback(
    (view: RunModalView) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("runView");
          if (view === "execution") {
            next.set("runTab", "runner");
            next.delete("runOverviewTab");
          } else if (next.get("runTab") === "runner") {
            next.delete("runTab");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setOverviewTab = useCallback(
    (tab: RunOverviewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("runOverviewTab");
          if (tab === "summary") {
            next.delete("runTab");
          } else {
            next.set("runTab", tab);
          }
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
              <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                data-testid="quality-run-overview-panel"
              >
                {runQuery.isPending ? (
                  <div className="overflow-auto p-4">
                    <p className="text-sm text-muted-foreground">{t("runsHub.modalLoadingRun")}</p>
                  </div>
                ) : runQuery.isError || !runQuery.data ? (
                  <div className="overflow-auto p-4">
                    <p className="text-sm text-muted-foreground">{t("runsHub.modalRunUnavailable")}</p>
                  </div>
                ) : (
                  <>
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <QualityRunOverviewBody
                        orgSlug={orgSlug}
                        projectSlug={projectSlug}
                        projectId={project.id}
                        run={runQuery.data}
                        runArtifactId={runExecute}
                        overviewTab={overviewTab}
                        onOverviewTabChange={setOverviewTab}
                        onOpenExecution={() => setRunView("execution")}
                      />
                    </div>
                    <div className="border-t border-border/60 bg-background px-4 py-3">
                      <Button type="button" variant="outline" onClick={handleExit}>
                        {t("common.close")}
                      </Button>
                    </div>
                  </>
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
