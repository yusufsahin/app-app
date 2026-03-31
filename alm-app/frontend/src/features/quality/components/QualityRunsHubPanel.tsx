import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Download, PlayCircle, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useArtifacts, type Artifact } from "../../../shared/api/artifactApi";
import type { ArtifactLink } from "../../../shared/api/artifactLinkApi";
import { apiClient } from "../../../shared/api/client";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "../../../shared/components/ui";
import { StartSuiteRunDialog } from "./StartSuiteRunDialog";
import { useStartSuiteRun } from "../hooks/useStartSuiteRun";
import {
  downloadRunsCsv,
  filterRunsForHub,
  type CsvRunRowInput,
  type RunQuickFilterId,
} from "../lib/qualityRunHubFilters";
import { formatRunEnvironmentLabel, summarizeRunMetricsFromCustomFields } from "../lib/runMetrics";
import { navigateToManualExecution, navigateToRunDetails } from "../lib/qualityOpenManualRunner";

type Props = {
  treeId?: string;
};

function RunsTableSkeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-2" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 border-b border-border/40 py-2 last:border-0">
          <Skeleton className="h-4 flex-[2]" />
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 w-20 shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-8 w-36 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function QualityRunsHubPanel({ treeId = "testsuites" }: Props) {
  const { t } = useTranslation("quality");
  const navigate = useNavigate();
  const { orgSlug, projectSlug, project } = useArtifactsPageProject();
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState<RunQuickFilterId>("all");

  const runsQuery = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    "test-run",
    "updated_at",
    "desc",
    undefined,
    200,
    0,
    false,
    undefined,
    undefined,
    undefined,
    treeId,
    false,
    undefined,
  );

  const suitesQuery = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    "test-suite",
    "title",
    "asc",
    undefined,
    500,
    0,
    false,
    undefined,
    undefined,
    undefined,
    treeId,
    false,
    undefined,
  );

  const startRun = useStartSuiteRun(orgSlug, project?.id, projectSlug);

  const suitesById = useMemo(() => {
    const m = new Map<string, Artifact>();
    for (const a of suitesQuery.data?.items ?? []) {
      m.set(a.id, a);
    }
    return m;
  }, [suitesQuery.data?.items]);

  const allRuns = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data?.items]);

  const filteredRuns = useMemo(
    () => filterRunsForHub(allRuns, { text: runFilter, quick: quickFilter }),
    [allRuns, runFilter, quickFilter],
  );

  const linkQueries = useQueries({
    queries: filteredRuns.map((run) => ({
      queryKey: ["orgs", orgSlug, "projects", project?.id, "artifacts", run.id, "links"] as const,
      queryFn: async (): Promise<ArtifactLink[]> => {
        const { data } = await apiClient.get<ArtifactLink[]>(
          `/orgs/${orgSlug}/projects/${project!.id}/artifacts/${run.id}/links`,
        );
        return data;
      },
      enabled: Boolean(orgSlug && project?.id && run.id),
    })),
  });

  const suiteTitleByRunId = useMemo(() => {
    const m = new Map<string, string>();
    filteredRuns.forEach((run, i) => {
      const q = linkQueries[i];
      if (!q?.data) return;
      const link = q.data.find(
        (l) => l.link_type === "run_for_suite" && l.from_artifact_id === run.id,
      );
      if (!link) return;
      const suite = suitesById.get(link.to_artifact_id);
      m.set(run.id, suite?.title?.trim() || link.to_artifact_id);
    });
    return m;
  }, [filteredRuns, linkQueries, suitesById]);

  const runsListSummary = useMemo(() => {
    const total = allRuns.length;
    const textActive = runFilter.trim().length > 0;
    const quickActive = quickFilter !== "all";
    if (!textActive && !quickActive) {
      return total === 1 ? t("runsHub.runsTotalOne") : t("runsHub.runsTotalShort", { total });
    }
    const shown = filteredRuns.length;
    if (quickActive) {
      return t("runsHub.runsShownOfTotal", { shown, total });
    }
    if (shown === total) {
      return total === 1 ? t("runsHub.runsFilterAllMatchOne") : t("runsHub.runsFilterAllMatchMany", { total });
    }
    if (shown === 1) {
      return t("runsHub.runsFilterPartialOneOfMany", { total });
    }
    return t("runsHub.runsFilterPartialMany", { shown, total });
  }, [allRuns.length, filteredRuns.length, runFilter, quickFilter, t]);

  const selectedSuite = selectedSuiteId ? suitesById.get(selectedSuiteId) : undefined;
  const defaultRunTitle =
    selectedSuite?.title != null && selectedSuite.title !== ""
      ? `${selectedSuite.title} — ${dayjs().format("YYYY-MM-DD HH:mm")}`
      : dayjs().format("YYYY-MM-DD HH:mm");

  const suiteItems = suitesQuery.data?.items ?? [];
  const hasSuites = suiteItems.length > 0;

  const onConfirmNewRun = async (values: { title: string; description: string; environment?: string }) => {
    if (!selectedSuite?.parent_id) return;
    await startRun.mutateAsync({
      suiteId: selectedSuite.id,
      suiteParentId: selectedSuite.parent_id,
      title: values.title,
      description: values.description,
      environment: values.environment,
    });
    setNewRunOpen(false);
    setSelectedSuiteId("");
  };

  const canOpenNewRun = !!selectedSuiteId && !!selectedSuite?.parent_id && !suitesQuery.isPending;

  const onExportCsv = () => {
    if (filteredRuns.length === 0) return;
    const rows: CsvRunRowInput[] = filteredRuns.map((run, rowIndex) => {
      const cf = run.custom_fields as Record<string, unknown> | undefined;
      const summary = summarizeRunMetricsFromCustomFields(cf);
      const q = linkQueries[rowIndex];
      let suiteTitle = "";
      if (q?.isPending) suiteTitle = t("runsHub.suiteLoading");
      else if (q?.data) {
        const link = q.data.find(
          (l) => l.link_type === "run_for_suite" && l.from_artifact_id === run.id,
        );
        if (link) {
          const suite = suitesById.get(link.to_artifact_id);
          suiteTitle = suite?.title?.trim() || link.to_artifact_id;
        }
      }
      if (!suiteTitle) suiteTitle = t("runsHub.suiteNone");
      return {
        title: run.title ?? "",
        artifactKey: run.artifact_key ?? "",
        id: run.id,
        state: run.state ?? "",
        updatedAt: run.updated_at ?? "",
        environment: formatRunEnvironmentLabel(cf),
        passed: summary.passed,
        failed: summary.failed,
        blocked: summary.blocked,
        notExecuted: summary.notExecuted,
        suiteTitle,
      };
    });
    const slug = projectSlug ?? "runs";
    downloadRunsCsv(rows, `test-runs_${slug}_${dayjs().format("YYYY-MM-DD")}`);
  };

  const quickFilterButtons: { id: RunQuickFilterId; label: string }[] = [
    { id: "all", label: t("runsHub.quickFilterAll") },
    { id: "has_failed", label: t("runsHub.quickFilterHasFailed") },
    { id: "last_7_days", label: t("runsHub.quickFilterLast7Days") },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-lg" data-testid="quality-runs-hub-heading">
                {t("runsHub.allRunsTitle")}
              </CardTitle>
              <CardDescription>{t("runsHub.allRunsDescription")}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
              <span id="runs-hub-new-run-label" className="text-sm font-medium">
                {t("runsHub.newRunSuiteLabel")}
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={selectedSuiteId}
                  onValueChange={setSelectedSuiteId}
                  disabled={!hasSuites && !suitesQuery.isPending}
                >
                  <SelectTrigger
                    className="w-full sm:min-w-[220px]"
                    aria-labelledby="runs-hub-new-run-label"
                    aria-describedby={!hasSuites && !suitesQuery.isPending ? "runs-hub-no-suites-hint" : undefined}
                  >
                    <SelectValue placeholder={t("runsHub.selectSuitePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {suiteItems.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title ?? s.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => setNewRunOpen(true)}
                  disabled={!canOpenNewRun}
                  title={!hasSuites ? t("runsHub.noSuitesForNewRun") : undefined}
                >
                  {t("runsHub.newRun")}
                </Button>
              </div>
              {!hasSuites && !suitesQuery.isPending ? (
                <p id="runs-hub-no-suites-hint" className="text-xs text-muted-foreground">
                  {t("runsHub.noSuitesForNewRun")}
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {runsQuery.isError ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
              role="alert"
            >
              <p className="font-medium text-destructive">{t("runsHub.loadRunsError")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void runsQuery.refetch()}
              >
                {t("runsHub.retry")}
              </Button>
            </div>
          ) : null}

          {!runsQuery.isError && allRuns.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2" role="group" aria-labelledby="runs-hub-quick-filters">
                  <span id="runs-hub-quick-filters" className="text-xs font-medium text-muted-foreground">
                    {t("runsHub.quickFilterLabel")}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {quickFilterButtons.map(({ id, label }) => (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant={quickFilter === id ? "secondary" : "outline"}
                        aria-pressed={quickFilter === id}
                        onClick={() => setQuickFilter(id)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 self-start sm:self-center"
                  disabled={filteredRuns.length === 0}
                  onClick={onExportCsv}
                  aria-label={t("runsHub.exportCsvAria")}
                >
                  <Download className="mr-1 size-4 shrink-0" aria-hidden />
                  {t("runsHub.exportCsv")}
                </Button>
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  className="pl-9"
                  value={runFilter}
                  onChange={(e) => setRunFilter(e.target.value)}
                  placeholder={t("runsHub.filterRunsPlaceholder")}
                  aria-label={t("runsHub.filterRunsPlaceholder")}
                />
              </div>
            </div>
          ) : null}

          {runsQuery.isPending ? (
            <RunsTableSkeleton label={t("runsHub.loadingRunsSkeletonAria")} />
          ) : runsQuery.isError ? null : allRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("runsHub.emptyAllRuns")}</p>
          ) : filteredRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("runsHub.noRunsMatchFilter")}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground" data-testid="quality-runs-hub-count">
                {runsListSummary}
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="sr-only">{t("runsHub.tableCaption")}</caption>
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("runsHub.colTitle")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("runsHub.colSuite")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("runsHub.colUpdated")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("runsHub.colEnvironment")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("runsHub.colSummary")}
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("runsHub.colActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map((run, rowIndex) => {
                      const cf = run.custom_fields as Record<string, unknown> | undefined;
                      const env = formatRunEnvironmentLabel(cf);
                      const summary = summarizeRunMetricsFromCustomFields(cf);
                      const summaryLabel =
                        summary.total === 0
                          ? t("runsHub.summaryEmpty")
                          : t("runsHub.summaryCounts", {
                              passed: summary.passed,
                              failed: summary.failed,
                              blocked: summary.blocked,
                              notExecuted: summary.notExecuted,
                            });
                      const titleText = run.title ?? run.id;
                      const linkQ = linkQueries[rowIndex];
                      let suiteCell = t("runsHub.suiteNone");
                      if (linkQ?.isPending) suiteCell = t("runsHub.suiteLoading");
                      else {
                        const resolved = suiteTitleByRunId.get(run.id);
                        if (resolved) suiteCell = resolved;
                      }
                      return (
                        <tr
                          key={run.id}
                          className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                        >
                          <td className="max-w-[220px] px-3 py-2 font-medium">
                            <span className="line-clamp-2 break-words" title={titleText}>
                              {titleText}
                            </span>
                          </td>
                          <td className="max-w-[160px] px-3 py-2 text-muted-foreground">
                            <span className="line-clamp-2 break-words" title={suiteCell}>
                              {suiteCell}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                            {run.updated_at ? dayjs(run.updated_at).format("YYYY-MM-DD HH:mm") : "—"}
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground" title={env}>
                            {env}
                          </td>
                          <td className="max-w-[min(280px,40vw)] px-3 py-2 text-muted-foreground">
                            <span className="line-clamp-2" title={summaryLabel}>
                              {summaryLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                title={t("runsHub.executeInModal")}
                                onClick={() => {
                                  if (!orgSlug || !projectSlug) return;
                                  navigateToManualExecution(navigate, orgSlug, projectSlug, run.id);
                                }}
                              >
                                <PlayCircle className="mr-1 size-4 shrink-0" aria-hidden />
                                {t("runsHub.executeOrContinue")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (!orgSlug || !projectSlug) return;
                                  navigateToRunDetails(navigate, orgSlug, projectSlug, run.id);
                                }}
                              >
                                {t("runsHub.openDetails")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <StartSuiteRunDialog
        open={newRunOpen}
        onClose={() => setNewRunOpen(false)}
        suiteTitle={selectedSuite?.title ?? ""}
        defaultTitle={defaultRunTitle}
        isSubmitting={startRun.isPending}
        onConfirm={(values) => void onConfirmNewRun(values)}
      />
    </div>
  );
}
