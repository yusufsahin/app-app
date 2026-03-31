import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardCopy, Loader2 } from "lucide-react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../shared/components/ui";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { useArtifactsPageProject } from "./useArtifactsPageProject";
import {
  useRequirementTraceabilityMatrix,
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

const STATUS_CLASS: Record<string, string> = {
  passed: "bg-emerald-600 text-white",
  failed: "bg-destructive text-white",
  blocked: "bg-amber-600 text-white",
  "not-executed": "bg-yellow-500 text-black",
  no_run: "bg-slate-400 text-black",
  not_covered: "bg-sky-600 text-white",
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

export default function RequirementTraceabilityMatrixPage() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug, project, projectsLoading } = useArtifactsPageProject();
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("traceabilityMatrix.filtersUnder")}
              </label>
              <Input
                value={draftUnder}
                onChange={(e) => setDraftUnder(e.target.value)}
                placeholder={t("traceabilityMatrix.filtersUnderPlaceholder")}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("traceabilityMatrix.scopeRun")}
              </label>
              <Input value={draftRun} onChange={(e) => setDraftRun(e.target.value)} className="font-mono text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("traceabilityMatrix.scopeSuite")}
              </label>
              <Input value={draftSuite} onChange={(e) => setDraftSuite(e.target.value)} className="font-mono text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("traceabilityMatrix.scopeCampaign")}
              </label>
              <Input
                value={draftCampaign}
                onChange={(e) => setDraftCampaign(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("traceabilityMatrix.search")}
              </label>
              <Input
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder={t("traceabilityMatrix.searchPlaceholder")}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("traceabilityMatrix.scopeHint")}</p>
          <div className="flex items-center gap-2">
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
            <Button type="button" size="sm" variant="secondary" onClick={forceRefresh}>
              {t("traceabilityMatrix.refresh")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void copyRelationships()}>
              <ClipboardCopy className="mr-1 size-3.5" />
              {t("traceabilityMatrix.copyRelationships")}
            </Button>
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
            </div>
          ) : null}

          {matrixQuery.isPending ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t("traceabilityMatrix.loading")}
            </div>
          ) : matrixQuery.isError ? (
            <p className="text-sm text-destructive">
              {t("traceabilityMatrix.error")}
              {errDetail ? `: ${errDetail}` : ""}
            </p>
          ) : (
            <Tabs value={activeTab} onValueChange={setTab} className="w-full">
              <TabsList className="h-9 w-full flex-wrap justify-start gap-1">
                <TabsTrigger value="matrix">{t("traceabilityMatrix.tabs.matrix")}</TabsTrigger>
                <TabsTrigger value="relationships">{t("traceabilityMatrix.tabs.relationships")}</TabsTrigger>
              </TabsList>

              <TabsContent value="matrix" className="mt-3">
                {!matrixQuery.data?.rows.length || !matrixQuery.data.columns.length ? (
                  <p className="text-sm text-muted-foreground">{t("traceabilityMatrix.empty")}</p>
                ) : (
                  <div className="overflow-auto rounded-md border">
                    <table className="min-w-max border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                          <th className="sticky left-0 z-20 min-w-[260px] border-b border-r bg-muted/80 px-3 py-2">
                            {t("traceabilityMatrix.requirementColumn")}
                          </th>
                          {matrixQuery.data.columns.map((column) => (
                            <th key={column.test_id} className="min-w-[120px] border-b border-r px-2 py-2 align-bottom">
                              <div className="max-w-[120px]">
                                <p className="truncate font-medium" title={columnLabel(column)}>
                                  {column.artifact_key ?? column.title}
                                </p>
                                {column.artifact_key ? (
                                  <p className="truncate text-[10px] text-muted-foreground" title={column.title}>
                                    {column.title}
                                  </p>
                                ) : null}
                              </div>
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
                                  <p className="truncate font-medium">{row.title}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {row.artifact_key ?? row.requirement_id}
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
                              {matrixQuery.data.columns.map((column) => {
                                const cell = byTest.get(column.test_id);
                                return (
                                  <td key={column.test_id} className="border-b border-r px-2 py-2 text-center align-middle">
                                    {cell ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <Badge
                                          className={STATUS_CLASS[cell.status ?? "no_run"] ?? "bg-muted text-foreground"}
                                          title={`${columnLabel(column)}${cell.run_title ? ` • ${cell.run_title}` : ""}`}
                                        >
                                          {t(
                                            `requirementCoverage.statusLabels.${cell.status ?? "no_run"}` as never,
                                            { defaultValue: cell.status ?? "no_run" },
                                          )}
                                        </Badge>
                                        {orgSlug && projectSlug ? (
                                          <Link
                                            to={qualityCatalogArtifactPath(orgSlug, projectSlug, column.test_id)}
                                            className="text-[11px] text-primary underline-offset-4 hover:underline"
                                          >
                                            {t("traceabilityMatrix.openTest")}
                                          </Link>
                                        ) : null}
                                      </div>
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
