import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardCopy, Download, FilterX, Loader2, Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "../../../shared/components/ui";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { useBacklogWorkspaceProject } from "./useBacklogWorkspaceProject";
import {
  useRequirementTraceabilityMatrix,
  useRequirementTraceabilityMatrixSummary,
  type TraceabilityMatrixColumn,
  type TraceabilityMatrixRow,
  type TraceabilityRelationship,
} from "../../../shared/api/requirementTraceabilityApi";
import {
  artifactDetailPath,
  artifactsPath,
  qualityCatalogArtifactPath,
  qualityPath,
} from "../../../shared/utils/appPaths";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { buildWorkbookBlob, downloadBlobFile } from "../../../shared/lib/xlsxExport";

const STATUS_CLASS: Record<string, string> = {
  passed: "bg-emerald-600",
  failed: "bg-destructive",
  blocked: "bg-amber-600",
  "not-executed": "bg-yellow-500",
  no_run: "bg-slate-400",
  not_covered: "bg-sky-600",
};

function isUuid(value: string | null): boolean {
  if (!value?.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function cellByTestId(row: TraceabilityMatrixRow): Map<string, TraceabilityMatrixRow["cells"][number]> {
  return new Map(row.cells.map((cell) => [cell.test_id, cell]));
}

function columnLabel(column: TraceabilityMatrixColumn): string {
  return column.artifact_key ? `${column.artifact_key} - ${column.title}` : column.title;
}

function scopeFieldTone(active: boolean) {
  return active ? "border-primary bg-primary/5" : "border-border";
}

function matrixSheetRows(
  rows: TraceabilityMatrixRow[],
  columns: TraceabilityMatrixColumn[],
  t: ReturnType<typeof useTranslation<"quality">>["t"],
): Array<Array<string>> {
  const header = [
    t("traceabilityMatrix.requirementColumn"),
    ...columns.map((column) => column.artifact_key ?? column.title),
  ];
  return [
    header,
    ...rows.map((row) => {
      const byTest = cellByTestId(row);
      return [
        row.artifact_key ? `${row.artifact_key} - ${row.title}` : row.title,
        ...columns.map((column) => {
          const cell = byTest.get(column.test_id);
          if (!cell) return "-";
          return t(`requirementCoverage.statusLabels.${cell.status ?? "no_run"}` as never, {
            defaultValue: cell.status ?? "no_run",
          });
        }),
      ];
    }),
  ];
}

function relationshipSheetRows(
  relationships: TraceabilityRelationship[],
  t: ReturnType<typeof useTranslation<"quality">>["t"],
): Array<Array<string>> {
  return [
    [
      t("traceabilityMatrix.relationshipCols.requirement"),
      t("traceabilityMatrix.relationshipCols.test"),
      t("traceabilityMatrix.relationshipCols.linkType"),
      t("traceabilityMatrix.relationshipCols.status"),
      t("traceabilityMatrix.relationshipCols.run"),
    ],
    ...relationships.map((row) => [
      row.requirement_artifact_key ? `${row.requirement_artifact_key} - ${row.requirement_title}` : row.requirement_title,
      row.test_artifact_key ? `${row.test_artifact_key} - ${row.test_title}` : row.test_title,
      row.link_type,
      t(`requirementCoverage.statusLabels.${row.status ?? "no_run"}` as never, {
        defaultValue: row.status ?? "no_run",
      }),
      row.run_title ?? "",
    ]),
  ];
}

export default function RequirementTraceabilityMatrixPage() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug, project, projectsLoading } = useBacklogWorkspaceProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const showNotification = useNotificationStore((s) => s.showNotification);

  const [draftUnder, setDraftUnder] = useState(() => searchParams.get("under") ?? "");
  const [draftRun, setDraftRun] = useState(() => searchParams.get("scopeRun") ?? "");
  const [draftSuite, setDraftSuite] = useState(() => searchParams.get("scopeSuite") ?? "");
  const [draftCampaign, setDraftCampaign] = useState(() => searchParams.get("scopeCampaign") ?? "");
  const [draftSearch, setDraftSearch] = useState(() => searchParams.get("q") ?? "");
  const [draftIncludeReverse, setDraftIncludeReverse] = useState(() => searchParams.get("reverse") !== "0");

  const activeTab = searchParams.get("tab") === "relationships" ? "relationships" : "matrix";
  const appliedUnder = searchParams.get("under")?.trim() || undefined;
  const appliedRun = searchParams.get("scopeRun")?.trim() || undefined;
  const appliedSuite = searchParams.get("scopeSuite")?.trim() || undefined;
  const appliedCampaign = searchParams.get("scopeCampaign")?.trim() || undefined;
  const appliedSearch = searchParams.get("q")?.trim() || undefined;
  const appliedRefresh = searchParams.get("refresh") === "1";
  const appliedIncludeReverse = searchParams.get("reverse") !== "0";

  const queryParams = useMemo(
    () => ({
      under: appliedUnder && isUuid(appliedUnder) ? appliedUnder : undefined,
      scopeRunId: appliedRun && isUuid(appliedRun) ? appliedRun : undefined,
      scopeSuiteId: appliedSuite && isUuid(appliedSuite) ? appliedSuite : undefined,
      scopeCampaignId: appliedCampaign && isUuid(appliedCampaign) ? appliedCampaign : undefined,
      search: appliedSearch,
      refresh: appliedRefresh,
      includeReverseVerifies: appliedIncludeReverse,
    }),
    [
      appliedUnder,
      appliedRun,
      appliedSuite,
      appliedCampaign,
      appliedSearch,
      appliedRefresh,
      appliedIncludeReverse,
    ],
  );

  const matrixQuery = useRequirementTraceabilityMatrix(orgSlug, project?.id, queryParams, !!project?.id);
  const summaryQuery = useRequirementTraceabilityMatrixSummary(orgSlug, project?.id, queryParams, !!project?.id);

  const updateExclusiveScope = useCallback(
    (scope: "run" | "suite" | "campaign", value: string) => {
      if (scope === "run") {
        setDraftRun(value);
        if (value.trim()) {
          setDraftSuite("");
          setDraftCampaign("");
        }
      }
      if (scope === "suite") {
        setDraftSuite(value);
        if (value.trim()) {
          setDraftRun("");
          setDraftCampaign("");
        }
      }
      if (scope === "campaign") {
        setDraftCampaign(value);
        if (value.trim()) {
          setDraftRun("");
          setDraftSuite("");
        }
      }
    },
    [],
  );

  const applyFilters = () => {
    const u = draftUnder.trim();
    const r = draftRun.trim();
    const s = draftSuite.trim();
    const c = draftCampaign.trim();
    const q = draftSearch.trim();
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (u && isUuid(u)) n.set("under", u);
      else n.delete("under");
      if (r && isUuid(r)) n.set("scopeRun", r);
      else n.delete("scopeRun");
      if (s && isUuid(s)) n.set("scopeSuite", s);
      else n.delete("scopeSuite");
      if (c && isUuid(c)) n.set("scopeCampaign", c);
      else n.delete("scopeCampaign");
      if (q) n.set("q", q);
      else n.delete("q");
      if (!draftIncludeReverse) n.set("reverse", "0");
      else n.delete("reverse");
      n.delete("refresh");
      return n;
    }, { replace: true });
  };

  const forceRefresh = () => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set("refresh", "1");
      return n;
    }, { replace: true });
  };

  const setTab = (nextTab: string) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (nextTab === "relationships") n.set("tab", "relationships");
      else n.delete("tab");
      return n;
    }, { replace: true });
  };

  const copyRelationships = useCallback(async () => {
    const relationships = matrixQuery.data?.relationships ?? [];
    if (!relationships.length) return;
    const header = [
      "requirement_key",
      "requirement_title",
      "test_key",
      "test_title",
      "link_type",
      "status",
      "run_title",
    ].join("\t");
    const lines = relationships.map((row: TraceabilityRelationship) =>
      [
        row.requirement_artifact_key ?? "",
        row.requirement_title.replace(/\t/g, " "),
        row.test_artifact_key ?? "",
        row.test_title.replace(/\t/g, " "),
        row.link_type,
        row.status ?? "",
        (row.run_title ?? "").replace(/\t/g, " "),
      ].join("\t"),
    );
    try {
      await navigator.clipboard.writeText([header, ...lines].join("\n"));
      showNotification(t("traceabilityMatrix.relationshipsCopied"), "success");
    } catch {
      showNotification(t("traceabilityMatrix.relationshipsCopyFailed"), "error");
    }
  }, [matrixQuery.data?.relationships, showNotification, t]);

  const exportWorkbook = useCallback(async () => {
    const data = matrixQuery.data;
    if (!data) return;
    try {
      const blob = await buildWorkbookBlob([
        {
          name: t("traceabilityMatrix.tabs.matrix"),
          rows: matrixSheetRows(data.rows, data.columns, t),
        },
        {
          name: t("traceabilityMatrix.tabs.relationships"),
          rows: relationshipSheetRows(data.relationships, t),
        },
      ]);
      downloadBlobFile(blob, `traceability-matrix-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showNotification(t("traceabilityMatrix.exportSuccess"), "success");
    } catch {
      showNotification(t("traceabilityMatrix.exportFailed"), "error");
    }
  }, [matrixQuery.data, showNotification, t]);

  const clearFilters = useCallback(() => {
    setDraftUnder("");
    setDraftRun("");
    setDraftSuite("");
    setDraftCampaign("");
    setDraftSearch("");
    setDraftIncludeReverse(true);
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete("under");
      n.delete("scopeRun");
      n.delete("scopeSuite");
      n.delete("scopeCampaign");
      n.delete("q");
      n.delete("reverse");
      n.delete("refresh");
      return n;
    }, { replace: true });
  }, [setSearchParams]);

  const applyUnderFromSummary = useCallback(
    (artifactId: string) => {
      setDraftUnder(artifactId);
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.set("under", artifactId);
        n.delete("refresh");
        return n;
      }, { replace: true });
    },
    [setSearchParams],
  );

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return (
      <div className="mx-auto max-w-6xl py-6">
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      </div>
    );
  }

  const errDetail =
    matrixQuery.isError && matrixQuery.error && typeof matrixQuery.error === "object"
      ? (matrixQuery.error as { response?: { data?: { detail?: string } } }).response?.data?.detail
      : null;

  const activeScope =
    appliedRun ? t("traceabilityMatrix.scopeRunShort") :
    appliedSuite ? t("traceabilityMatrix.scopeSuiteShort") :
    appliedCampaign ? t("traceabilityMatrix.scopeCampaignShort") :
    null;

  const activeFilters = [
    appliedUnder ? t("traceabilityMatrix.activeFilterUnder", { value: appliedUnder }) : null,
    activeScope
      ? t("traceabilityMatrix.activeFilterScope", {
          scope: activeScope,
          value: appliedRun ?? appliedSuite ?? appliedCampaign ?? "",
        })
      : null,
    appliedSearch ? t("traceabilityMatrix.activeFilterSearch", { value: appliedSearch }) : null,
    !appliedIncludeReverse ? t("traceabilityMatrix.activeFilterReverseOff") : null,
  ].filter(Boolean) as string[];

  const errorGuidance = errDetail
    ? [
        /under=<artifact_id>|subtree/i.test(errDetail) ? t("traceabilityMatrix.guidanceUseUnder") : null,
        /column count too large|tests/i.test(errDetail) ? t("traceabilityMatrix.guidanceNarrowSearch") : null,
        /scope/i.test(errDetail) ? t("traceabilityMatrix.guidanceUseSingleScope") : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="mx-auto max-w-7xl min-h-0 px-4 py-6">
      <ProjectBreadcrumbs currentPageLabel={t("traceabilityMatrix.breadcrumb")} projectName={project?.name} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={orgSlug && projectSlug ? artifactsPath(orgSlug, projectSlug) : "#"}>
            {t("traceabilityMatrix.backArtifacts")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("traceabilityMatrix.title")}</CardTitle>
          <CardDescription>{t("traceabilityMatrix.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">{t("traceabilityMatrix.scopeCardTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("traceabilityMatrix.scopeCardDescription")}</p>
              </div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("traceabilityMatrix.filtersUnder")}
              </label>
              <Input
                value={draftUnder}
                onChange={(e) => setDraftUnder(e.target.value)}
                placeholder={t("traceabilityMatrix.filtersUnderPlaceholder")}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">{t("traceabilityMatrix.scopeHintUnder")}</p>
              <div className="grid gap-3">
                <div className={cn("rounded-md border p-3", scopeFieldTone(!!draftRun.trim()))}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("traceabilityMatrix.scopeRun")}
                  </label>
                  <Input
                    value={draftRun}
                    onChange={(e) => updateExclusiveScope("run", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className={cn("rounded-md border p-3", scopeFieldTone(!!draftSuite.trim()))}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("traceabilityMatrix.scopeSuite")}
                  </label>
                  <Input
                    value={draftSuite}
                    onChange={(e) => updateExclusiveScope("suite", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className={cn("rounded-md border p-3", scopeFieldTone(!!draftCampaign.trim()))}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("traceabilityMatrix.scopeCampaign")}
                  </label>
                  <Input
                    value={draftCampaign}
                    onChange={(e) => updateExclusiveScope("campaign", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">{t("traceabilityMatrix.searchCardTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("traceabilityMatrix.searchCardDescription")}</p>
              </div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("traceabilityMatrix.search")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  placeholder={t("traceabilityMatrix.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("traceabilityMatrix.searchHint")}</p>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <Checkbox
                  id="traceability-include-reverse"
                  checked={draftIncludeReverse}
                  onCheckedChange={(v) => setDraftIncludeReverse(v === true)}
                />
                <label htmlFor="traceability-include-reverse" className="text-sm leading-none">
                  {t("traceabilityMatrix.includeReverseVerifies")}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={applyFilters}>
                  {t("traceabilityMatrix.applyFilters")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                  <FilterX className="mr-1 size-3.5" />
                  {t("traceabilityMatrix.clearFilters")}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={forceRefresh}>
                  {t("traceabilityMatrix.refresh")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void exportWorkbook()}
                  disabled={!matrixQuery.data}
                >
                  <Download className="mr-1 size-3.5" />
                  {t("traceabilityMatrix.exportExcel")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyRelationships()}>
                  <ClipboardCopy className="mr-1 size-3.5" />
                  {t("traceabilityMatrix.copyRelationships")}
                </Button>
              </div>
            </div>
          </div>

          {matrixQuery.data ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("traceabilityMatrix.computedAt", {
                  iso: new Date(matrixQuery.data.computed_at).toLocaleString(),
                })}
              </span>
              {matrixQuery.data.cache_hit ? (
                <Badge variant="secondary">{t("traceabilityMatrix.cacheHit")}</Badge>
              ) : null}
              <Badge variant="outline">
                {t("traceabilityMatrix.summary", {
                  rows: matrixQuery.data.rows.length,
                  columns: matrixQuery.data.columns.length,
                  relationships: matrixQuery.data.relationships.length,
                })}
              </Badge>
              {matrixQuery.data.truncated ? <Badge variant="outline">{t("traceabilityMatrix.truncated")}</Badge> : null}
            </div>
          ) : null}

          {summaryQuery.data ? (
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={summaryQuery.data.can_render_matrix ? "secondary" : "outline"}>
                  {summaryQuery.data.can_render_matrix
                    ? t("traceabilityMatrix.summaryReady")
                    : t("traceabilityMatrix.summaryNeedsNarrowing")}
                </Badge>
                <Badge variant="outline">
                  {t("traceabilityMatrix.summaryProjectNodes", { count: summaryQuery.data.project_node_count })}
                </Badge>
                <Badge variant="outline">
                  {t("traceabilityMatrix.summarySubtreeNodes", { count: summaryQuery.data.subtree_node_count })}
                </Badge>
                <Badge variant="outline">
                  {t("traceabilityMatrix.summaryRows", { count: summaryQuery.data.candidate_requirement_row_count })}
                </Badge>
                <Badge variant="outline">
                  {t("traceabilityMatrix.summaryColumns", { count: summaryQuery.data.distinct_test_count })}
                </Badge>
                <Badge variant="outline">
                  {t("traceabilityMatrix.summaryRelationships", { count: summaryQuery.data.relationship_count })}
                </Badge>
              </div>

              {!summaryQuery.data.can_render_matrix ? (
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{t("traceabilityMatrix.summaryBlockedTitle")}</p>
                  {summaryQuery.data.exceeds_project_without_under_limit ? (
                    <p>{t("traceabilityMatrix.summaryBlockedProjectWide")}</p>
                  ) : null}
                  {summaryQuery.data.exceeds_subtree_limit ? (
                    <p>{t("traceabilityMatrix.summaryBlockedSubtree")}</p>
                  ) : null}
                  {summaryQuery.data.exceeds_row_limit ? (
                    <p>{t("traceabilityMatrix.summaryBlockedRows")}</p>
                  ) : null}
                  {summaryQuery.data.exceeds_column_limit ? (
                    <p>{t("traceabilityMatrix.summaryBlockedColumns")}</p>
                  ) : null}
                </div>
              ) : null}

              {summaryQuery.data.child_subtrees.length ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("traceabilityMatrix.childSubtrees")}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {summaryQuery.data.child_subtrees
                      .filter((item) => item.requirement_row_count > 0 || item.subtree_node_count > 0)
                      .slice(0, 9)
                      .map((item) => (
                        <button
                          key={item.artifact_id}
                          type="button"
                          onClick={() => applyUnderFromSummary(item.artifact_id)}
                          className="rounded-md border bg-background p-3 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <p className="truncate font-medium">
                            {item.artifact_key ? `${item.artifact_key} - ${item.title}` : item.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("traceabilityMatrix.childSubtreeSummary", {
                              nodes: item.subtree_node_count,
                              rows: item.requirement_row_count,
                              columns: item.distinct_test_count,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("traceabilityMatrix.childSubtreeRelationships", { count: item.relationship_count })}
                          </p>
                          <p className="mt-2 text-xs font-medium text-primary">
                            {t("traceabilityMatrix.childSubtreeApply")}
                          </p>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeFilters.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t("traceabilityMatrix.activeFiltersLabel")}</span>
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="outline" className="max-w-full truncate">
                  {filter}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("traceabilityMatrix.activeFiltersEmpty")}</p>
          )}

          {matrixQuery.isPending ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t("traceabilityMatrix.loading")}
            </div>
          ) : matrixQuery.isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                {t("traceabilityMatrix.error")}
                {errDetail ? `: ${errDetail}` : ""}
              </p>
              {errorGuidance.length ? (
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {errorGuidance.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setTab} className="w-full">
              <TabsList className="h-9 w-full flex-wrap justify-start gap-1">
                <TabsTrigger value="matrix">{t("traceabilityMatrix.tabs.matrix")}</TabsTrigger>
                <TabsTrigger value="relationships">{t("traceabilityMatrix.tabs.relationships")}</TabsTrigger>
              </TabsList>

              <TabsContent value="matrix" className="mt-3">
                {summaryQuery.data && !summaryQuery.data.can_render_matrix ? (
                  <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{t("traceabilityMatrix.summaryBlockedTitle")}</p>
                    <p className="mt-1">{t("traceabilityMatrix.summaryBlockedHint")}</p>
                  </div>
                ) : !matrixQuery.data?.rows.length || !matrixQuery.data.columns.length ? (
                  <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{t("traceabilityMatrix.emptyTitle")}</p>
                    <p className="mt-1">{t("traceabilityMatrix.empty")}</p>
                    <p className="mt-2">{t("traceabilityMatrix.emptyHint")}</p>
                  </div>
                ) : (
                  <div className="overflow-auto rounded-md border">
                    <table className="min-w-max border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                          <th className="sticky left-0 z-20 min-w-[260px] border-b border-r bg-muted/80 px-3 py-2">
                            {t("traceabilityMatrix.requirementColumn")}
                          </th>
                          {matrixQuery.data.columns.map((column) => (
                            <th key={column.test_id} className="min-w-[72px] border-b border-r px-1 py-2 align-bottom">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {orgSlug && projectSlug ? (
                                    <Link
                                      to={qualityCatalogArtifactPath(orgSlug, projectSlug, column.test_id)}
                                      className="flex h-[180px] w-[68px] items-end justify-center rounded-sm px-1 pb-2 text-center hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      aria-label={t("traceabilityMatrix.openTestWithName", { name: columnLabel(column) })}
                                    >
                                      <span className="line-clamp-1 [writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-[0.02em]">
                                        {column.artifact_key ?? column.title}
                                      </span>
                                    </Link>
                                  ) : (
                                    <div className="flex h-[180px] w-[68px] items-end justify-center px-1 pb-2 text-center">
                                      <span className="line-clamp-1 [writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-[0.02em]">
                                        {column.artifact_key ?? column.title}
                                      </span>
                                    </div>
                                  )}
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                  <p className="font-medium">{columnLabel(column)}</p>
                                  <p className="mt-1 text-[11px] opacity-90">{t("traceabilityMatrix.headerTooltipOpenTest")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixQuery.data.rows.map((row) => {
                          const byTest = cellByTestId(row);
                          return (
                            <tr key={row.requirement_id}>
                              <td className="sticky left-0 z-10 border-b border-r bg-background px-3 py-2">
                                <div className="min-w-0">
                                  {orgSlug && projectSlug ? (
                                    <Link
                                      to={artifactDetailPath(orgSlug, projectSlug, row.requirement_id)}
                                      className="group block rounded-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      <p className="truncate font-medium group-hover:text-primary">{row.title}</p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {row.artifact_key ?? row.requirement_id}
                                      </p>
                                    </Link>
                                  ) : (
                                    <>
                                      <p className="truncate font-medium">{row.title}</p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {row.artifact_key ?? row.requirement_id}
                                      </p>
                                    </>
                                  )}
                                </div>
                              </td>
                              {matrixQuery.data.columns.map((column) => {
                                const cell = byTest.get(column.test_id);
                                const statusKey = cell?.status ?? "no_run";
                                const statusLabel = t(`requirementCoverage.statusLabels.${statusKey}` as never, {
                                  defaultValue: statusKey,
                                });
                                return (
                                  <td key={column.test_id} className="border-b border-r px-1 py-1 text-center align-middle">
                                    {cell ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            className="flex items-center justify-center"
                                            aria-label={t("traceabilityMatrix.cellTooltip", {
                                              requirement: row.artifact_key ?? row.title,
                                              test: columnLabel(column),
                                              status: statusLabel,
                                              run: cell.run_title ?? t("traceabilityMatrix.noRunTitle"),
                                            })}
                                          >
                                            <span
                                              className={cn(
                                                "inline-flex size-3.5 rounded-full ring-2 ring-background",
                                                STATUS_CLASS[statusKey] ?? "bg-muted",
                                              )}
                                            />
                                            <span className="sr-only">{statusLabel}</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <p className="font-medium">{statusLabel}</p>
                                          <p>{columnLabel(column)}</p>
                                          <p>{row.artifact_key ?? row.title}</p>
                                          <p className="mt-1 text-[11px] opacity-90">
                                            {cell.run_title
                                              ? t("traceabilityMatrix.cellRun", { run: cell.run_title })
                                              : t("traceabilityMatrix.cellNoRun")}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="relationships" className="mt-3">
                {!matrixQuery.data?.relationships.length ? (
                  <p className="text-sm text-muted-foreground">{t("traceabilityMatrix.emptyRelationships")}</p>
                ) : (
                  <div className="overflow-auto rounded-md border">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                          <th className="px-3 py-2">{t("traceabilityMatrix.relationshipCols.requirement")}</th>
                          <th className="px-3 py-2">{t("traceabilityMatrix.relationshipCols.test")}</th>
                          <th className="px-3 py-2">{t("traceabilityMatrix.relationshipCols.linkType")}</th>
                          <th className="px-3 py-2">{t("traceabilityMatrix.relationshipCols.status")}</th>
                          <th className="px-3 py-2">{t("traceabilityMatrix.relationshipCols.run")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrixQuery.data.relationships.map((row) => (
                          <tr key={`${row.requirement_id}:${row.test_id}`} className="border-b last:border-0">
                            <td className="px-3 py-2 align-top">
                              <div className="min-w-0">
                                <p className="font-medium">{row.requirement_title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {row.requirement_artifact_key ?? row.requirement_id}
                                </p>
                                {orgSlug && projectSlug ? (
                                  <Link
                                    to={artifactDetailPath(orgSlug, projectSlug, row.requirement_id)}
                                    className="text-xs text-primary underline-offset-4 hover:underline"
                                  >
                                    {t("traceabilityMatrix.openRequirement")}
                                  </Link>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="min-w-0">
                                <p className="font-medium">{row.test_title}</p>
                                <p className="text-xs text-muted-foreground">{row.test_artifact_key ?? row.test_id}</p>
                                {orgSlug && projectSlug ? (
                                  <Link
                                    to={qualityCatalogArtifactPath(orgSlug, projectSlug, row.test_id)}
                                    className="text-xs text-primary underline-offset-4 hover:underline"
                                  >
                                    {t("traceabilityMatrix.openTest")}
                                  </Link>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <code className="text-xs">{row.link_type}</code>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Badge className={STATUS_CLASS[row.status ?? "no_run"] ?? "bg-muted text-foreground"}>
                                {t(`requirementCoverage.statusLabels.${row.status ?? "no_run"}` as never, {
                                  defaultValue: row.status ?? "no_run",
                                })}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 align-top">
                              {row.run_id && orgSlug && projectSlug ? (
                                <Link
                                  to={qualityPath(orgSlug, projectSlug, { artifact: row.run_id, tree: "testsuites" })}
                                  className="text-primary underline-offset-4 hover:underline"
                                >
                                  {row.run_title ?? t("traceabilityMatrix.openRun")}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">{row.run_title ?? "-"}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
