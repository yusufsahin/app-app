import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Download, FileSpreadsheet, Loader2, Plus, Play } from "lucide-react";
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import {
  useCreateReportFromCatalog,
  useReportDefinitions,
  useReportRegistryDefinitions,
  useReportTemplateCatalog,
  useRunReportRegistry,
  type ReportRunRegistryResponse,
} from "../../../shared/api/reportDefinitionsApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { formatDateTime } from "../../../shared/utils/formatDateTime";
import { projectReportDetailPath, projectReportNewPath } from "../../../shared/utils/appPaths";
import { getReportApiErrorMessage } from "../lib/reportApiErrors";
import { REPORT_PREVIEW_ROW_LIMITS } from "../lib/previewRowLimits";
import { downloadJsonFile, downloadReportCsv } from "../lib/downloadReportCsv";
import { registrySeriesTable } from "../lib/registrySeriesTable";
import { registryDefaultParams } from "../lib/registryDefaultParams";
import { jsonParseErrorLine } from "../lib/jsonParseErrorLine";
import { DEFAULT_APP_DOCUMENT_TITLE } from "../lib/defaultDocumentTitle";
import { ManifestEditor } from "../../../shared/components/ManifestEditor";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Badge,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui";

type ReportListSort = "updated_desc" | "updated_asc" | "name_asc" | "name_desc";

export default function ProjectReportsPage() {
  const { t } = useTranslation("reports");
  const showNotification = useNotificationStore((s) => s.showNotification);
  const navigate = useNavigate();
  const { orgSlug, projectSlug, project } = useBacklogWorkspaceProject();
  const projectId = project?.id;
  const {
    data: definitions,
    isLoading: definitionsLoading,
    isError: definitionsError,
    error: definitionsErr,
    refetch: refetchDefinitions,
  } = useReportDefinitions(orgSlug, projectId);
  const {
    data: catalog = [],
    isError: catalogError,
    error: catalogErr,
    refetch: refetchCatalog,
  } = useReportTemplateCatalog(orgSlug);
  const {
    data: registry = [],
    isError: registryError,
    error: registryErr,
    refetch: refetchRegistry,
  } = useReportRegistryDefinitions(orgSlug);
  const createFromCatalog = useCreateReportFromCatalog(orgSlug, projectId);
  const runRegistry = useRunReportRegistry(orgSlug);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const [quickReportId, setQuickReportId] = useState("");
  const [paramsJson, setParamsJson] = useState("{}");
  const [runResult, setRunResult] = useState<string | null>(null);
  const [lastRegistryResult, setLastRegistryResult] = useState<ReportRunRegistryResponse | null>(null);
  const [paramsError, setParamsError] = useState<string | null>(null);
  const [paramsJsonErrorLine, setParamsJsonErrorLine] = useState<number | undefined>();
  const [listSearch, setListSearch] = useState("");
  const [listSort, setListSort] = useState<ReportListSort>("updated_desc");
  const [quickRunError, setQuickRunError] = useState<string | null>(null);
  const [quickRunRowLimit, setQuickRunRowLimit] = useState(5000);

  const definitionRows = useMemo(() => definitions ?? [], [definitions]);
  const filteredDefinitions = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    let rows = [...definitionRows];
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    rows.sort((a, b) => {
      if (listSort === "name_asc" || listSort === "name_desc") {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        return listSort === "name_asc" ? cmp : -cmp;
      }
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return listSort === "updated_desc" ? tb - ta : ta - tb;
    });
    return rows;
  }, [definitionRows, listSearch, listSort]);

  const defaultRegistryId = registry[0]?.id ?? "";
  const effectiveQuickReportId = quickReportId || defaultRegistryId;
  const selectedRegistryItem = useMemo(
    () => registry.find((r) => r.id === effectiveQuickReportId) ?? null,
    [registry, effectiveQuickReportId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset row limit when switching registry report
    setQuickRunRowLimit(5000);
  }, [quickReportId]);

  const paramsTouched = useRef(false);
  useEffect(() => {
    if (!projectId || !effectiveQuickReportId || paramsTouched.current) return;
    if (paramsJson.trim() !== "{}") return;
    const defaults = selectedRegistryItem
      ? registryDefaultParams(selectedRegistryItem.parameter_schema, { projectId })
      : { project_id: projectId };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize JSON defaults once registry selection resolves
    setParamsJson(Object.keys(defaults).length ? JSON.stringify(defaults, null, 2) : "{}");
  }, [projectId, effectiveQuickReportId, selectedRegistryItem, paramsJson]);

  const quickRunSeriesExport = useMemo(
    () => (lastRegistryResult ? registrySeriesTable(lastRegistryResult.data) : null),
    [lastRegistryResult],
  );

  useLayoutEffect(() => {
    if (!orgSlug || !projectSlug || !projectId) {
      return;
    }
    document.title = t("list.browserTitle");
    return () => {
      document.title = DEFAULT_APP_DOCUMENT_TITLE;
    };
  }, [orgSlug, projectSlug, projectId, t]);

  const handleQuickRun = async () => {
    setQuickRunError(null);
    setParamsError(null);
    setParamsJsonErrorLine(undefined);
    setRunResult(null);
    setLastRegistryResult(null);
    let parameters: Record<string, unknown>;
    try {
      parameters = paramsJson.trim() ? (JSON.parse(paramsJson) as Record<string, unknown>) : {};
    } catch (e) {
      setParamsJsonErrorLine(jsonParseErrorLine(e));
      setParamsError(t("new.invalidJson"));
      return;
    }
    if (!effectiveQuickReportId) {
      setParamsError(t("new.builtinRequired"));
      return;
    }
    try {
      const res = await runRegistry.mutateAsync({
        report_id: effectiveQuickReportId,
        parameters,
        row_limit: quickRunRowLimit,
      });
      setLastRegistryResult(res);
      setRunResult(JSON.stringify(res, null, 2));
    } catch (err) {
      const msg = getReportApiErrorMessage(err, t("list.runFailed"));
      setQuickRunError(msg);
      showNotification(msg, "error");
    }
  };

  if (!orgSlug || !projectSlug || !projectId) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-8 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("list.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("list.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to={projectReportNewPath(orgSlug, projectSlug)}>{t("list.newSqlReport")}</Link>
          </Button>
          <Button type="button" onClick={() => setCatalogOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t("list.fromTemplate")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.quickRun")}</CardTitle>
          <CardDescription>{t("list.quickRunHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {registryError ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">
                {getReportApiErrorMessage(registryErr, t("list.registryLoadFailed"))}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchRegistry()}>
                {t("list.retry")}
              </Button>
            </div>
          ) : null}
          {registry.length === 0 && !registryError ? (
            <p className="text-sm text-muted-foreground">{t("list.registryEmpty")}</p>
          ) : null}
          {registry.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="quick-report-select">{t("list.reportId")}</Label>
                <Select
                  value={quickReportId || defaultRegistryId}
                  onValueChange={(id) => {
                    setQuickReportId(id);
                    setQuickRunError(null);
                    paramsTouched.current = false;
                  }}
                >
                  <SelectTrigger id="quick-report-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {registry.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title} ({r.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-run-row-limit" className="text-muted-foreground">
                  {t("list.quickRunRowLimit")}
                </Label>
                <Select
                  value={String(quickRunRowLimit)}
                  onValueChange={(v) => setQuickRunRowLimit(Number(v))}
                  disabled={runRegistry.isPending}
                >
                  <SelectTrigger id="quick-run-row-limit" className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_PREVIEW_ROW_LIMITS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="quick-params">{t("list.parametersJson")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={runRegistry.isPending || !projectId || !selectedRegistryItem}
                    onClick={() => {
                      paramsTouched.current = false;
                      const defaults = selectedRegistryItem
                        ? registryDefaultParams(selectedRegistryItem.parameter_schema, { projectId })
                        : {};
                      setParamsJson(Object.keys(defaults).length ? JSON.stringify(defaults, null, 2) : "{}");
                      setParamsJsonErrorLine(undefined);
                      setParamsError(null);
                      setQuickRunError(null);
                    }}
                  >
                    {t("list.resetParams")}
                  </Button>
                </div>
                <div id="quick-params">
                  <ManifestEditor
                    value={paramsJson}
                    onChange={(v) => {
                      paramsTouched.current = true;
                      setParamsJson(v);
                      setParamsJsonErrorLine(undefined);
                      setParamsError(null);
                      setQuickRunError(null);
                    }}
                    language="json"
                    height={200}
                    errorLine={paramsJsonErrorLine}
                    loadingPlaceholder={
                      <div
                        className="flex items-center justify-center bg-muted/50 text-sm text-muted-foreground"
                      >
                        {t("new.editorLoading")}
                      </div>
                    }
                  />
                </div>
              </div>
              {paramsError ? <p className="text-sm text-destructive">{paramsError}</p> : null}
              <Button type="button" variant="secondary" disabled={runRegistry.isPending} onClick={() => void handleQuickRun()}>
                <Play className="mr-2 size-4" />
                {runRegistry.isPending ? t("list.running") : t("list.run")}
              </Button>
              {quickRunError ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-destructive">{quickRunError}</p>
                  <Button type="button" variant="outline" size="sm" disabled={runRegistry.isPending} onClick={() => void handleQuickRun()}>
                    {t("list.retry")}
                  </Button>
                </div>
              ) : null}
              {runResult ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("list.runResult")}</p>
                  <ManifestEditor
                    value={runResult}
                    readOnly
                    language="json"
                    height={280}
                    loadingPlaceholder={
                      <div
                        className="flex items-center justify-center bg-muted/50 text-sm text-muted-foreground"
                      >
                        {t("new.editorLoading")}
                      </div>
                    }
                  />
                  {lastRegistryResult ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {t("detail.rowLimit", { limit: lastRegistryResult.row_limit })}
                        {Array.isArray(lastRegistryResult.data.series) ? (
                          <>
                            {" "}
                            · {t("list.runResultSeriesPoints", { count: lastRegistryResult.data.series.length })}
                          </>
                        ) : null}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            downloadJsonFile(
                              `registry-${lastRegistryResult.report_id.replace(/\./g, "_")}`,
                              lastRegistryResult,
                            )
                          }
                        >
                          <Download className="mr-2 size-4" />
                          {t("list.downloadRunJson")}
                        </Button>
                        {quickRunSeriesExport ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              downloadReportCsv(
                                `registry-${lastRegistryResult.report_id.replace(/\./g, "_")}-series`,
                                quickRunSeriesExport.columns,
                                quickRunSeriesExport.rows,
                              )
                            }
                          >
                            <FileSpreadsheet className="mr-2 size-4" />
                            {t("list.exportSeriesCsv")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.yourReports")}</CardTitle>
          <CardDescription>{t("list.yourReportsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {definitionsError ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">
                {getReportApiErrorMessage(definitionsErr, t("list.loadFailed"))}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchDefinitions()}>
                {t("list.retry")}
              </Button>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 max-w-md flex-1">
              <Label htmlFor="reports-search" className="sr-only">
                {t("list.searchPlaceholder")}
              </Label>
              <Input
                id="reports-search"
                type="search"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder={t("list.searchPlaceholder")}
                disabled={definitionsLoading || definitionsError}
              />
            </div>
            <div className="w-full space-y-2 sm:w-52">
              <Label htmlFor="reports-sort" className="text-muted-foreground">
                {t("list.sortLabel")}
              </Label>
              <Select
                value={listSort}
                onValueChange={(v) => setListSort(v as ReportListSort)}
                disabled={definitionsLoading || definitionsError}
              >
                <SelectTrigger id="reports-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_desc">{t("list.sortUpdatedDesc")}</SelectItem>
                  <SelectItem value="updated_asc">{t("list.sortUpdatedAsc")}</SelectItem>
                  <SelectItem value="name_asc">{t("list.sortNameAsc")}</SelectItem>
                  <SelectItem value="name_desc">{t("list.sortNameDesc")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {definitionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : definitionsError ? null : filteredDefinitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {definitionRows.length > 0 && listSearch.trim() ? t("list.noSearchResults") : t("list.empty")}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {filteredDefinitions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                  <div className="min-w-0">
                    <Link
                      to={projectReportDetailPath(orgSlug, projectSlug, r.id)}
                      className="font-medium text-primary hover:underline"
                      aria-label={t("list.openReportAria", { name: r.name })}
                    >
                      {r.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.query_kind}
                      {r.catalog_key ? ` · ${r.catalog_key}` : ""}
                      {r.updated_at ? ` · ${t("list.rowUpdated")}: ${formatDateTime(r.updated_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={r.lifecycle_status === "published" ? "default" : "secondary"}>
                      {r.lifecycle_status}
                    </Badge>
                    <Badge variant={r.last_validation_ok ? "outline" : "destructive"} className="font-normal">
                      {r.last_validation_ok ? t("list.validated") : t("list.notValidated")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("list.templatesTitle")}</DialogTitle>
            <DialogDescription>{t("list.templatesHint")}</DialogDescription>
          </DialogHeader>
          {catalogError ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">
                {getReportApiErrorMessage(catalogErr, t("list.templatesLoadFailed"))}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchCatalog()}>
                {t("list.retry")}
              </Button>
            </div>
          ) : null}
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {catalog.map((item) => (
              <li key={item.catalog_key}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                  disabled={createFromCatalog.isPending}
                  onClick={async () => {
                    try {
                      const created = await createFromCatalog.mutateAsync({
                        catalog_key: item.catalog_key,
                        name: null,
                      });
                      setCatalogOpen(false);
                      navigate(projectReportDetailPath(orgSlug, projectSlug, created.id));
                    } catch (err) {
                      showNotification(getReportApiErrorMessage(err, t("new.createFailed")), "error");
                    }
                  }}
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">{item.description}</div>
                  </div>
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
