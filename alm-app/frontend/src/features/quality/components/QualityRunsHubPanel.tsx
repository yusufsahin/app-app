import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { PlayCircle, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useArtifacts, type Artifact } from "../../../shared/api/artifactApi";
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
import { formatRunEnvironmentLabel, summarizeRunMetricsFromCustomFields } from "../lib/runMetrics";
import { qualityRunWorkspaceDetailPath } from "../lib/qualityRunPaths";
import { openManualRunnerInNewWindow } from "../lib/qualityOpenManualRunner";

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
  const { orgSlug, projectSlug, project } = useArtifactsPageProject();
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [runFilter, setRunFilter] = useState("");

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

  const filteredRuns = useMemo(() => {
    const q = runFilter.trim().toLowerCase();
    if (!q) return allRuns;
    return allRuns.filter((run) => {
      const title = (run.title ?? "").toLowerCase();
      const key = (run.artifact_key ?? "").toLowerCase();
      return title.includes(q) || key.includes(q) || run.id.toLowerCase().includes(q);
    });
  }, [allRuns, runFilter]);

  const runsListSummary = useMemo(() => {
    const total = allRuns.length;
    const shown = filteredRuns.length;
    const filterActive = runFilter.trim().length > 0;
    if (!filterActive) {
      return total === 1 ? t("runsHub.runsTotalOne") : t("runsHub.runsTotalShort", { total });
    }
    if (shown === total) {
      return total === 1 ? t("runsHub.runsFilterAllMatchOne") : t("runsHub.runsFilterAllMatchMany", { total });
    }
    if (shown === 1) {
      return t("runsHub.runsFilterPartialOneOfMany", { total });
    }
    return t("runsHub.runsFilterPartialMany", { shown, total });
  }, [allRuns.length, filteredRuns.length, runFilter, t]);

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
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">{t("runsHub.tableCaption")}</caption>
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        {t("runsHub.colTitle")}
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
                    {filteredRuns.map((run) => {
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
                      const detailsTo =
                        orgSlug && projectSlug
                          ? qualityRunWorkspaceDetailPath(orgSlug, projectSlug, run.id, run.parent_id)
                          : "#";
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
                                title={t("runsHub.executeInNewWindow")}
                                onClick={() => {
                                  if (!orgSlug || !projectSlug) return;
                                  openManualRunnerInNewWindow(orgSlug, projectSlug, run.id);
                                }}
                              >
                                <PlayCircle className="mr-1 size-4 shrink-0" aria-hidden />
                                {t("runsHub.executeOrContinue")}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" asChild>
                                <Link to={detailsTo}>{t("runsHub.openDetails")}</Link>
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
