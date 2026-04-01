import JSZip from "jszip";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { artifactDetailPath } from "../../../shared/utils/appPaths";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { toast } from "sonner";
import { Badge, Button, ScrollArea, Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui";
import type { Artifact } from "../../../shared/stores/artifactStore";
import { useArtifactRelationships } from "../../../shared/api/relationshipApi";
import { useAttachments, downloadAttachmentBlob } from "../../../shared/api/attachmentApi";
import type { Attachment } from "../../../shared/api/attachmentApi";
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

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(lines: string[]): string {
  return "\uFEFF" + lines.join("\n");
}

function downloadGeneratedFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildRunHistoryCsv(entries: NonNullable<ReturnType<typeof useEntityHistory>["data"]>["entries"]): string | null {
  if (entries.length === 0) return null;
  const lines = [
    ["version", "committed_at", "change_type", "author_id", "changed_properties", "changes_json"].join(","),
    ...entries.map((entry) =>
      [
        csvEscape(entry.snapshot.version),
        csvEscape(entry.snapshot.committed_at),
        csvEscape(entry.snapshot.change_type),
        csvEscape(entry.snapshot.author_id),
        csvEscape(entry.snapshot.changed_properties.join(";")),
        csvEscape(JSON.stringify(entry.changes)),
      ].join(","),
    ),
  ];
  return buildCsvContent(lines);
}

function buildRunStepsCsv(results: TestExecutionResultRow[]): string | null {
  if (results.length === 0) return null;
  const lines = [
    [
      "test_index",
      "test_id",
      "test_status",
      "configuration_name",
      "step_number",
      "step_id",
      "step_name",
      "expected_result",
      "status",
      "actual_result",
      "notes",
      "linked_defect_ids",
      "attachment_ids",
    ].join(","),
  ];
  for (const [rowIndex, row] of results.entries()) {
    const steps: TestStep[] = row.expandedStepsSnapshot?.length
      ? row.expandedStepsSnapshot
      : row.stepResults.map((sr, i) => ({
          id: sr.stepId,
          stepNumber: i + 1,
          name: sr.stepNameSnapshot ?? sr.stepId,
          description: "",
          expectedResult: sr.expectedResultSnapshot ?? "",
          status: sr.status,
          actualResult: sr.actualResult,
          notes: sr.notes,
        }));
    const stepResultsById = new Map(row.stepResults.map((step) => [step.stepId, step]));
    for (const [stepIndex, step] of steps.entries()) {
      const detail = stepResultsById.get(step.id) ?? row.stepResults[stepIndex];
      lines.push(
        [
          csvEscape(rowIndex + 1),
          csvEscape(row.testId),
          csvEscape(row.status),
          csvEscape(row.configurationName ?? ""),
          csvEscape(step.stepNumber ?? stepIndex + 1),
          csvEscape(step.id),
          csvEscape(step.name),
          csvEscape(step.expectedResult),
          csvEscape(detail?.status ?? step.status),
          csvEscape(detail?.actualResult ?? step.actualResult ?? ""),
          csvEscape(detail?.notes ?? step.notes ?? ""),
          csvEscape((detail?.linkedDefectIds ?? []).join(";")),
          csvEscape((detail?.attachmentIds ?? []).join(";")),
        ].join(","),
      );
    }
  }
  return buildCsvContent(lines);
}

function sanitizeZipPathPart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

function getRowsWithParams(results: TestExecutionResultRow[]): TestExecutionResultRow[] {
  return results.filter((r) => {
    const values = r.resolvedValues ?? r.paramValuesUsed;
    return values && Object.keys(values).length > 0;
  });
}

function buildRunParametersCsv(results: TestExecutionResultRow[]): string | null {
  const rowsWithParams = getRowsWithParams(results);
  if (rowsWithParams.length === 0) return null;
  const lines = [
    [
      "test_index",
      "test_id",
      "test_status",
      "configuration_id",
      "configuration_name",
      "parameter_key",
      "parameter_value",
    ].join(","),
  ];
  for (const [idx, row] of rowsWithParams.entries()) {
    const values = row.resolvedValues ?? row.paramValuesUsed ?? {};
    for (const [key, value] of Object.entries(values)) {
      lines.push(
        [
          csvEscape(idx + 1),
          csvEscape(row.testId),
          csvEscape(row.status),
          csvEscape(row.configurationId ?? ""),
          csvEscape(row.configurationName ?? ""),
          csvEscape(key),
          csvEscape(value),
        ].join(","),
      );
    }
  }
  return buildCsvContent(lines);
}

function buildRunAttachmentsCsv(attachments: Attachment[], results: TestExecutionResultRow[]): string | null {
  if (attachments.length === 0) return null;
  const attachmentUsage = new Map<string, Set<string>>();
  for (const row of results) {
    for (const step of row.stepResults) {
      for (const attachmentId of step.attachmentIds ?? []) {
        const references = attachmentUsage.get(attachmentId) ?? new Set<string>();
        references.add(String(step.stepNumber ?? step.stepId));
        attachmentUsage.set(attachmentId, references);
      }
    }
  }
  const lines = [
    [
      "attachment_id",
      "file_name",
      "content_type",
      "size",
      "created_by",
      "created_at",
      "referenced_by_steps",
    ].join(","),
  ];
  for (const attachment of attachments) {
    lines.push(
      [
        csvEscape(attachment.id),
        csvEscape(attachment.file_name),
        csvEscape(attachment.content_type),
        csvEscape(attachment.size),
        csvEscape(attachment.created_by ?? ""),
        csvEscape(attachment.created_at ?? ""),
        csvEscape(Array.from(attachmentUsage.get(attachment.id) ?? []).join(";")),
      ].join(","),
    );
  }
  return buildCsvContent(lines);
}

function buildAttachmentFailuresReport(
  failures: Array<{ attachmentId: string; fileName: string; error: string }>,
): string | null {
  if (failures.length === 0) return null;
  const lines = [
    ["attachment_id", "file_name", "error"].join(","),
    ...failures.map((failure) =>
      [csvEscape(failure.attachmentId), csvEscape(failure.fileName), csvEscape(failure.error)].join(","),
    ),
  ];
  return buildCsvContent(lines);
}

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
  const [bundleExporting, setBundleExporting] = useState(false);
  const [bundleExportLabel, setBundleExportLabel] = useState<string | null>(null);

  const results = useMemo(() => parseRunMetricsPayload(cf?.run_metrics_json) ?? [], [cf?.run_metrics_json]);
  const evidenceSummary = useMemo(() => {
    let stepsWithDefects = 0;
    let totalDefects = 0;
    let stepsWithEvidence = 0;
    let totalEvidence = 0;
    for (const row of results) {
      for (const step of row.stepResults) {
        const defectCount = step.linkedDefectIds?.length ?? 0;
        const evidenceCount = step.attachmentIds?.length ?? 0;
        if (defectCount > 0) {
          stepsWithDefects += 1;
          totalDefects += defectCount;
        }
        if (evidenceCount > 0) {
          stepsWithEvidence += 1;
          totalEvidence += evidenceCount;
        }
      }
    }
    return { stepsWithDefects, totalDefects, stepsWithEvidence, totalEvidence };
  }, [results]);

  const linksQuery = useArtifactRelationships(orgSlug, projectId, runArtifactId);
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

  const onExportHistoryCsv = () => {
    const entries = historyQuery.data?.entries ?? [];
    const csv = buildRunHistoryCsv(entries);
    if (!csv) return;
    downloadGeneratedFile(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `run-history-${run.artifact_key ?? run.id}.csv`,
    );
  };

  const onExportStepsCsv = () => {
    const csv = buildRunStepsCsv(results);
    if (!csv) return;
    downloadGeneratedFile(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `run-steps-${run.artifact_key ?? run.id}.csv`,
    );
  };

  const onExportBundle = async () => {
    if (bundleExporting) return;
    setBundleExporting(true);
    setBundleExportLabel(t("runsHub.overviewBundleExportLoading"));
    try {
      const zip = new JSZip();
      const runKey = run.artifact_key ?? run.id;
      const historyCsv = buildRunHistoryCsv(historyQuery.data?.entries ?? []);
      const stepsCsv = buildRunStepsCsv(results);
      const paramsCsv = buildRunParametersCsv(results);
      const attachments = attachmentsQuery.data ?? [];
      const attachmentsCsv = buildRunAttachmentsCsv(attachments, results);
      const includedFiles: string[] = [];
      const attachmentFiles: string[] = [];
      const failedAttachments: Array<{ attachmentId: string; fileName: string; error: string }> = [];

      if (historyCsv) {
        const name = `run-history-${runKey}.csv`;
        zip.file(name, historyCsv);
        includedFiles.push(name);
      }
      if (stepsCsv) {
        const name = `run-steps-${runKey}.csv`;
        zip.file(name, stepsCsv);
        includedFiles.push(name);
      }
      if (paramsCsv) {
        const name = `run-parameters-${runKey}.csv`;
        zip.file(name, paramsCsv);
        includedFiles.push(name);
      }
      if (attachmentsCsv) {
        const name = `run-attachments-${runKey}.csv`;
        zip.file(name, attachmentsCsv);
        includedFiles.push(name);
      }

      for (const [index, attachment] of attachments.entries()) {
        setBundleExportLabel(
          t("runsHub.overviewBundleExportDownloadingAttachment", {
            current: index + 1,
            total: attachments.length,
          }),
        );
        try {
          const attachmentBlob = await downloadAttachmentBlob(orgSlug, projectId, runArtifactId, attachment.id);
          const attachmentPath = `attachments/${sanitizeZipPathPart(attachment.file_name || attachment.id)}`;
          zip.file(attachmentPath, attachmentBlob);
          attachmentFiles.push(attachmentPath);
        } catch (error) {
          failedAttachments.push({
            attachmentId: attachment.id,
            fileName: attachment.file_name || attachment.id,
            error:
              (error as { detail?: string; message?: string } | undefined)?.detail ??
              (error as { message?: string } | undefined)?.message ??
              t("runsHub.overviewBundleExportAttachmentError"),
          });
        }
      }
      if (Object.keys(zip.files).length === 0) return;

      setBundleExportLabel(t("runsHub.overviewBundleExportFinalizing"));

      const attachmentFailuresReport = buildAttachmentFailuresReport(failedAttachments);
      if (attachmentFailuresReport) {
        zip.file("attachment-failures.csv", attachmentFailuresReport);
        includedFiles.push("attachment-failures.csv");
      }

      zip.file(
        "manifest.json",
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            export_type: "quality_run_dossier",
            run: {
              id: run.id,
              artifact_key: run.artifact_key ?? null,
              title: run.title,
              state: run.state ?? null,
              project_id: projectId,
              artifact_id: runArtifactId,
            },
            counts: {
              tests: results.length,
              history_entries: historyQuery.data?.entries.length ?? 0,
              attachments: attachments.length,
              parameterized_tests: getRowsWithParams(results).length,
            },
            files: includedFiles,
            attachment_files: attachmentFiles,
            failed_attachments: failedAttachments,
          },
          null,
          2,
        ),
      );

      const blob = await zip.generateAsync({ type: "blob" });
      downloadGeneratedFile(blob, `run-export-${runKey}.zip`);
      if (failedAttachments.length > 0) {
        toast.success(t("runsHub.overviewBundleExportPartialSuccess", { count: failedAttachments.length }));
      }
    } catch (error) {
      const detail =
        (error as { detail?: string; message?: string } | undefined)?.detail ??
        (error as { message?: string } | undefined)?.message;
      toast.error(detail || t("runsHub.overviewBundleExportError"));
    } finally {
      setBundleExporting(false);
      setBundleExportLabel(null);
    }
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
          {evidenceSummary.totalDefects > 0 || evidenceSummary.totalEvidence > 0 ? (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md border px-3 py-2">
                {t("runsHub.overviewStepDefectSummary", {
                  steps: evidenceSummary.stepsWithDefects,
                  defects: evidenceSummary.totalDefects,
                })}
              </div>
              <div className="rounded-md border px-3 py-2">
                {t("runsHub.overviewStepEvidenceSummary", {
                  steps: evidenceSummary.stepsWithEvidence,
                  evidence: evidenceSummary.totalEvidence,
                })}
              </div>
            </div>
          ) : null}
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
            <Button type="button" variant="outline" onClick={() => void onExportBundle()} disabled={bundleExporting}>
              {bundleExporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {bundleExporting ? bundleExportLabel ?? t("runsHub.overviewBundleExportLoading") : t("runsHub.overviewBundleExport")}
            </Button>
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
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={onExportStepsCsv}>
                {t("runsHub.overviewStepsExport")}
              </Button>
            </div>
            {results.map((row: TestExecutionResultRow, idx: number) => (
              <RunResultStepsSection key={`${row.testId}-${idx}`} row={row} index={idx} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="parameters" className="mt-0 flex-1 overflow-auto p-4 focus-visible:outline-none">
        <ParametersOverview results={results} runKey={run.artifact_key ?? run.id} />
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
            {linksQuery.data.map((relationship) => (
              <li
                key={relationship.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <Badge variant="outline" className="mr-2">
                    {relationship.relationship_type === "run_for_suite"
                      ? t("runsHub.linkRunForSuite")
                      : relationship.display_label}
                  </Badge>
                  <Link
                    to={artifactDetailPath(orgSlug, projectSlug, relationship.other_artifact_id)}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    title={relationship.other_artifact_id}
                  >
                    {(relationship.other_artifact_key ?? relationship.other_artifact_id).slice(0, 8)}…
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
            {attachmentsQuery.data.map((att) => {
              const referencedBySteps = results.flatMap((row) =>
                row.stepResults
                  .filter((step) => step.attachmentIds?.includes(att.id))
                  .map((step) => step.stepNumber ?? step.stepId),
              );
              return (
                <li key={att.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="min-w-0 truncate" title={att.file_name}>
                    {att.file_name}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {referencedBySteps.length > 0 ? (
                      <Badge variant="outline">
                        {t("runsHub.overviewAttachmentReferencedBy", {
                          steps: referencedBySteps.join(", "),
                        })}
                      </Badge>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => void onDownload(att.id, att.file_name)}>
                      {t("runsHub.overviewDownload")}
                    </Button>
                  </div>
                </li>
              );
            })}
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
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={onExportHistoryCsv}>
                {t("runsHub.overviewHistoryExport")}
              </Button>
            </div>
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
          </div>
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
        {row.configurationName ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t("runsHub.overviewConfigurationName", { name: row.configurationName })}
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

function ParametersOverview({ results, runKey }: { results: TestExecutionResultRow[]; runKey: string }) {
  const { t } = useTranslation("quality");
  const rowsWithParams = getRowsWithParams(results);
  if (rowsWithParams.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("runsHub.overviewParamsEmpty")}</p>;
  }

  const onExportParamsCsv = () => {
    const csv = buildRunParametersCsv(results);
    if (!csv) return;
    downloadGeneratedFile(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `run-parameters-${runKey}.csv`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={onExportParamsCsv}>
          {t("runsHub.overviewParamsExport")}
        </Button>
      </div>
      {rowsWithParams.map((r, idx) => (
        <div key={`${r.testId}-params-${idx}`} className="rounded-md border">
          <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium">
            {t("runsHub.overviewParamsForTest", { index: idx + 1 })}
            {r.configurationName ? (
              <span className="ml-2 text-muted-foreground">
                {t("runsHub.overviewConfigurationName", { name: r.configurationName })}
              </span>
            ) : null}
          </div>
          <dl className="grid gap-2 p-3 text-sm sm:grid-cols-2">
            {Object.entries(r.resolvedValues ?? r.paramValuesUsed ?? {}).map(([k, v]) => (
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
