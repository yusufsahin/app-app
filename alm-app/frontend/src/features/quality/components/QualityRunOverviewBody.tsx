import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { Badge, Button, ScrollArea, Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui";
import type { Artifact } from "../../../shared/stores/artifactStore";
import { useArtifactLinks } from "../../../shared/api/artifactLinkApi";
import { useAttachments, downloadAttachmentBlob } from "../../../shared/api/attachmentApi";
import { useEntityHistory } from "../../../shared/api/auditApi";
import {
  formatRunEnvironmentLabel,
  parseRunMetricsPayload,
  summarizeRunMetricsFromCustomFields,
  type TestExecutionResultRow,
} from "../lib/runMetrics";
import type { RunOverviewTab } from "../lib/qualityOpenManualRunner";
import { RUN_OVERVIEW_TABS } from "../lib/qualityOpenManualRunner";
import { ExecutionStepList } from "./ExecutionStepList";
import type { StepResult, TestStep } from "../types";
import { pickDefectArtifactType } from "../lib/defectManifestHelpers";
import { RunPreviousCompareSection } from "./RunPreviousCompareSection";

type PrimaryAction = "continue" | "rerun" | "start" | "details";

function getPrimaryActionForRunState(state: string | null | undefined): PrimaryAction {
  const normalized = (state ?? "").trim().toLowerCase();
  if (!normalized) return "details";
  if (["queued", "in_progress", "paused"].includes(normalized)) return "continue";
  if (["failed", "completed", "cancelled"].includes(normalized)) return "rerun";
  if (["draft", "not_started"].includes(normalized)) return "start";
  return "details";
}

function noopStepUpdate() {}

type Props = {
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  run: Artifact;
  runArtifactId: string;
  overviewTab: RunOverviewTab;
  onOverviewTabChange: (tab: RunOverviewTab) => void;
  onOpenExecution: () => void;
};

export function QualityRunOverviewBody({
  orgSlug,
  projectSlug,
  projectId,
  run,
  runArtifactId,
  overviewTab,
  onOverviewTabChange,
  onOpenExecution,
}: Props) {
  const { t } = useTranslation("quality");
  const cf = run.custom_fields as Record<string, unknown> | undefined;
  const summary = summarizeRunMetricsFromCustomFields(cf);
  const action = getPrimaryActionForRunState(run.state);

  const results = useMemo(() => parseRunMetricsPayload(cf?.run_metrics_json) ?? [], [cf?.run_metrics_json]);

  const linksQuery = useArtifactLinks(orgSlug, projectId, runArtifactId);
  const attachmentsQuery = useAttachments(orgSlug, projectId, runArtifactId);
  const historyQuery = useEntityHistory("artifact", runArtifactId, 50, 0);
  const defectType = pickDefectArtifactType(undefined);

  const onDownload = async (attachmentId: string, fileName: string) => {
    const blob = await downloadAttachmentBlob(orgSlug, projectId, runArtifactId, attachmentId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Tabs
      value={overviewTab}
      onValueChange={(v) => onOverviewTabChange(v as RunOverviewTab)}
      className="flex h-full min-h-0 flex-1 flex-col gap-0"
    >
      <div className="border-b border-border/60 bg-muted/20 px-2 py-2 sm:px-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto w-max flex-wrap justify-start gap-1 bg-transparent p-0">
            {RUN_OVERVIEW_TABS.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="shrink-0 text-xs sm:text-sm"
                data-testid={`quality-run-overview-tab-${tab}`}
              >
                {t(`runsHub.overviewTab.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>
      </div>

      <TabsContent value="summary" className="mt-0 flex-1 overflow-auto p-4 focus-visible:outline-none">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{run.description || "—"}</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border px-3 py-2">{t("runsHub.modalPassed", { count: summary.passed })}</div>
            <div className="rounded-md border px-3 py-2">{t("runsHub.modalFailed", { count: summary.failed })}</div>
            <div className="rounded-md border px-3 py-2">{t("runsHub.modalBlocked", { count: summary.blocked })}</div>
            <div className="rounded-md border px-3 py-2">{t("runsHub.modalNotRun", { count: summary.notExecuted })}</div>
          </div>
          <RunPreviousCompareSection
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            projectId={projectId}
            runArtifactId={runArtifactId}
            currentResults={results}
          />
          <p className="text-xs text-muted-foreground">
            {t("runsHub.colEnvironment")}: {formatRunEnvironmentLabel(cf)}
          </p>
          <div className="flex flex-wrap gap-2">
            {action === "details" ? (
              <Button type="button" onClick={onOpenExecution}>
                {t("runsHub.modalOpenExecution")}
              </Button>
            ) : (
              <Button type="button" onClick={onOpenExecution}>
                {t(
                  action === "continue"
                    ? "runsHub.modalContinueRun"
                    : action === "rerun"
                      ? "runsHub.modalRerun"
                      : "runsHub.modalStartRun",
                )}
              </Button>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="steps" className="mt-0 flex-1 overflow-auto p-4 focus-visible:outline-none">
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("runsHub.overviewStepsEmpty")}</p>
        ) : (
          <div className="space-y-6">
            {results.map((row: TestExecutionResultRow, idx: number) => (
              <RunResultStepsSection key={`${row.testId}-${idx}`} row={row} index={idx} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="parameters" className="mt-0 flex-1 overflow-auto p-4 focus-visible:outline-none">
        <ParametersOverview results={results} />
      </TabsContent>

      <TabsContent value="linked" className="mt-0 flex-1 overflow-auto p-4 focus-visible:outline-none">
        {linksQuery.isPending ? (
          <p className="text-sm text-muted-foreground">{t("detail.traceabilityLoading")}</p>
        ) : linksQuery.isError ? (
          <p className="text-sm text-destructive">{t("runsHub.overviewLinkedError")}</p>
        ) : !linksQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">{t("runsHub.overviewLinkedEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {linksQuery.data.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <Badge variant="outline" className="mr-2">
                    {link.link_type === "run_for_suite" ? t("runsHub.linkRunForSuite") : link.link_type}
                  </Badge>
                  <Link
                    to={`/${orgSlug}/${projectSlug}/artifacts?artifact=${link.to_artifact_id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    title={link.to_artifact_id}
                  >
                    {link.to_artifact_id.slice(0, 8)}…
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {t("runsHub.overviewLinkedDefectHint", { defectType })}
        </p>
      </TabsContent>

      <TabsContent value="attachments" className="mt-0 flex-1 overflow-auto p-4 focus-visible:outline-none">
        {attachmentsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">{t("runsHub.overviewAttachmentsLoading")}</p>
        ) : attachmentsQuery.isError ? (
          <p className="text-sm text-destructive">{t("runsHub.overviewAttachmentsError")}</p>
        ) : !attachmentsQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">{t("runsHub.overviewAttachmentsEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {attachmentsQuery.data.map((att) => (
              <li key={att.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="min-w-0 truncate" title={att.file_name}>
                  {att.file_name}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => void onDownload(att.id, att.file_name)}>
                  {t("runsHub.overviewDownload")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-0 flex-1 overflow-auto p-4 focus-visible:outline-none">
        {historyQuery.isPending ? (
          <p className="text-sm text-muted-foreground">{t("runsHub.overviewHistoryLoading")}</p>
        ) : historyQuery.isError ? (
          <p className="text-sm text-destructive">{t("runsHub.overviewHistoryError")}</p>
        ) : !historyQuery.data?.entries.length ? (
          <p className="text-sm text-muted-foreground">{t("runsHub.overviewHistoryEmpty")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {historyQuery.data.entries.map((entry, i) => (
              <li key={entry.snapshot.id ?? i} className="rounded-md border px-3 py-2">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>v{entry.snapshot.version}</span>
                  {entry.snapshot.committed_at ? (
                    <span>{dayjs(entry.snapshot.committed_at).format("YYYY-MM-DD HH:mm")}</span>
                  ) : null}
                  <span>{entry.snapshot.change_type}</span>
                </div>
                {entry.changes.length > 0 ? (
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {entry.changes.slice(0, 8).map((c) => (
                      <li key={c.property_name}>
                        {c.property_name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function RunResultStepsSection({ row, index }: { row: TestExecutionResultRow; index: number }) {
  const { t } = useTranslation("quality");
  const steps: TestStep[] = row.expandedStepsSnapshot?.length
    ? row.expandedStepsSnapshot
    : row.stepResults.map((sr, i) => ({
        id: sr.stepId,
        stepNumber: i + 1,
        name: sr.stepId,
        description: "",
        expectedResult: "",
        status: sr.status,
        actualResult: sr.actualResult,
        notes: sr.notes,
      }));
  const results: StepResult[] =
    row.stepResults.length > 0
      ? row.stepResults
      : steps.map((s) => ({
          stepId: s.id,
          status: s.status,
          actualResult: s.actualResult,
          notes: s.notes,
        }));

  return (
    <div className="rounded-lg border border-border/80">
      <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
        {t("runsHub.overviewTestResultHeading", { index: index + 1, status: row.status })}
        {row.paramRowIndex != null ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t("runsHub.overviewParamRow", { row: row.paramRowIndex })}
          </span>
        ) : null}
      </div>
      <ExecutionStepList
        steps={steps}
        results={results}
        onUpdateStep={noopStepUpdate}
        readOnly
        layoutCompact
      />
    </div>
  );
}

function ParametersOverview({ results }: { results: TestExecutionResultRow[] }) {
  const { t } = useTranslation("quality");
  const rowsWithParams = results.filter((r) => r.paramValuesUsed && Object.keys(r.paramValuesUsed).length > 0);
  if (rowsWithParams.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("runsHub.overviewParamsEmpty")}</p>;
  }
  return (
    <div className="space-y-4">
      {rowsWithParams.map((r, idx) => (
        <div key={`${r.testId}-params-${idx}`} className="rounded-md border">
          <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium">
            {t("runsHub.overviewParamsForTest", { index: idx + 1 })}
          </div>
          <dl className="grid gap-2 p-3 text-sm sm:grid-cols-2">
            {Object.entries(r.paramValuesUsed!).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-mono text-xs break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
