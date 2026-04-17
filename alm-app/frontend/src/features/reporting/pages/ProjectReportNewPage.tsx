import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { getReportApiErrorMessage } from "../lib/reportApiErrors";
import { jsonParseErrorLine } from "../lib/jsonParseErrorLine";
import {
  useCreateReportDefinition,
  useReportRegistryDefinitions,
} from "../../../shared/api/reportDefinitionsApi";
import { projectReportDetailPath, projectReportsPath } from "../../../shared/utils/appPaths";
import { DEFAULT_APP_DOCUMENT_TITLE } from "../lib/defaultDocumentTitle";
import { ManifestEditor } from "../../../shared/components/ManifestEditor";
import { ReportSqlEditor } from "../components/ReportSqlEditor";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../shared/components/ui";

const DEFAULT_CHART_SPEC = `{
  "chartType": "bar",
  "xKey": "artifact_type",
  "yKeys": ["cnt"]
}`;

export default function ProjectReportNewPage() {
  const { t } = useTranslation("reports");
  const showNotification = useNotificationStore((s) => s.showNotification);
  const navigate = useNavigate();
  const { orgSlug, projectSlug, project } = useBacklogWorkspaceProject();
  const projectId = project?.id;
  const {
    data: registry = [],
    isError: registryError,
    error: registryErr,
    refetch: refetchRegistry,
  } = useReportRegistryDefinitions(orgSlug);
  const createMut = useCreateReportDefinition(orgSlug, projectId);

  const [tab, setTab] = useState<"sql" | "builtin">("sql");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [sqlText, setSqlText] = useState("");
  const [chartSpecJson, setChartSpecJson] = useState(DEFAULT_CHART_SPEC);
  const [builtinId, setBuiltinId] = useState("");
  const [builtinParamsJson, setBuiltinParamsJson] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [chartSpecErrorLine, setChartSpecErrorLine] = useState<number | undefined>();
  const [builtinParamsErrorLine, setBuiltinParamsErrorLine] = useState<number | undefined>();

  const defaultBuiltinId = useMemo(() => registry[0]?.id ?? "", [registry]);

  useEffect(() => {
    if (!builtinId && defaultBuiltinId) {
      setBuiltinId(defaultBuiltinId);
    }
  }, [builtinId, defaultBuiltinId]);

  useEffect(() => {
    setJsonError(null);
    setChartSpecErrorLine(undefined);
    setBuiltinParamsErrorLine(undefined);
  }, [tab]);

  useEffect(() => {
    if (tab !== "builtin" || !projectId) return;
    setBuiltinParamsJson((cur) => {
      if (cur.trim() === "{}") return JSON.stringify({ project_id: projectId }, null, 2);
      return cur;
    });
  }, [tab, projectId]);

  useLayoutEffect(() => {
    if (!orgSlug || !projectSlug || !projectId) {
      return;
    }
    document.title = t("new.browserTitle");
    return () => {
      document.title = DEFAULT_APP_DOCUMENT_TITLE;
    };
  }, [orgSlug, projectSlug, projectId, t]);

  const handleCreateSql = async () => {
    setJsonError(null);
    let chart_spec: Record<string, unknown>;
    try {
      chart_spec = chartSpecJson.trim() ? (JSON.parse(chartSpecJson) as Record<string, unknown>) : {};
    } catch (e) {
      setChartSpecErrorLine(jsonParseErrorLine(e));
      setJsonError(t("new.invalidJson"));
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        visibility,
        query_kind: "sql",
        sql_text: sqlText.trim(),
        chart_spec,
        builtin_report_id: null,
        builtin_parameters: {},
      });
      showNotification(t("new.created"), "success");
      if (orgSlug && projectSlug) {
        navigate(projectReportDetailPath(orgSlug, projectSlug, created.id));
      }
    } catch (err) {
      showNotification(getReportApiErrorMessage(err, t("new.createFailed")), "error");
    }
  };

  const handleCreateBuiltin = async () => {
    setJsonError(null);
    let builtin_parameters: Record<string, unknown>;
    try {
      builtin_parameters = builtinParamsJson.trim()
        ? (JSON.parse(builtinParamsJson) as Record<string, unknown>)
        : {};
    } catch (e) {
      setBuiltinParamsErrorLine(jsonParseErrorLine(e));
      setJsonError(t("new.invalidJson"));
      return;
    }
    if (!builtinId) {
      setJsonError(t("new.builtinRequired"));
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        visibility,
        query_kind: "builtin",
        builtin_report_id: builtinId,
        builtin_parameters,
        sql_text: null,
        chart_spec: {},
      });
      showNotification(t("new.created"), "success");
      if (orgSlug && projectSlug) {
        navigate(projectReportDetailPath(orgSlug, projectSlug, created.id));
      }
    } catch (err) {
      showNotification(getReportApiErrorMessage(err, t("new.createFailed")), "error");
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-8 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={projectReportsPath(orgSlug, projectSlug)} className="gap-2">
            <ArrowLeft className="size-4" />
            {t("new.backToList")}
          </Link>
        </Button>
        <BarChart3 className="size-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("new.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{t("new.subtitle")}</p>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {registryError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="text-destructive">
                {getReportApiErrorMessage(registryErr, t("list.registryLoadFailed"))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("new.registryLoadHint")}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetchRegistry()}>
                {t("detail.retry")}
              </Button>
            </div>
          ) : null}
          <Tabs value={tab} onValueChange={(v) => setTab(v as "sql" | "builtin")}>
            <TabsList className="mb-4">
              <TabsTrigger value="sql">{t("new.tabSql")}</TabsTrigger>
              <TabsTrigger value="builtin">{t("new.tabBuiltin")}</TabsTrigger>
            </TabsList>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">{t("new.name")}</Label>
                <Input
                  id="new-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("new.namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-desc">{t("new.description")}</Label>
                <Input id="new-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-visibility">{t("new.visibility")}</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger id="new-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">{t("new.visibilityPrivate")}</SelectItem>
                    <SelectItem value="project">{t("new.visibilityProject")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="sql" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-sql">{t("new.sqlLabel")}</Label>
                <div id="new-sql">
                  <ReportSqlEditor value={sqlText} onChange={setSqlText} height={300} />
                </div>
                <p className="text-xs text-muted-foreground">{t("new.sqlHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-chart">{t("new.chartSpecJson")}</Label>
                <div id="new-chart">
                  <ManifestEditor
                    value={chartSpecJson}
                    onChange={(v) => {
                      setChartSpecJson(v);
                      setChartSpecErrorLine(undefined);
                    }}
                    language="json"
                    height={220}
                    errorLine={chartSpecErrorLine}
                    loadingPlaceholder={
                      <div
                        style={{ height: 220 }}
                        className="flex items-center justify-center bg-muted/50 text-sm text-muted-foreground"
                      >
                        {t("new.editorLoading")}
                      </div>
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("new.chartSpecHint")}</p>
              </div>
              {jsonError && tab === "sql" ? <p className="text-sm text-destructive">{jsonError}</p> : null}
              <Button
                type="button"
                disabled={createMut.isPending || !name.trim() || !sqlText.trim()}
                onClick={() => void handleCreateSql()}
              >
                {createMut.isPending ? t("new.creating") : t("new.create")}
              </Button>
            </TabsContent>

            <TabsContent value="builtin" className="mt-6 space-y-4">
              {registry.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("new.registryEmpty")}</p>
              ) : (
              <div className="space-y-2">
                <Label htmlFor="new-builtin-select">{t("new.builtinId")}</Label>
                <Select value={builtinId || defaultBuiltinId} onValueChange={setBuiltinId}>
                  <SelectTrigger id="new-builtin-select">
                    <SelectValue placeholder={t("new.builtinId")} />
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
              )}
              {registry.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="new-builtin-json">{t("new.builtinParamsJson")}</Label>
                <div id="new-builtin-json">
                  <ManifestEditor
                    value={builtinParamsJson}
                    onChange={(v) => {
                      setBuiltinParamsJson(v);
                      setBuiltinParamsErrorLine(undefined);
                    }}
                    language="json"
                    height={240}
                    errorLine={builtinParamsErrorLine}
                    loadingPlaceholder={
                      <div
                        style={{ height: 240 }}
                        className="flex items-center justify-center bg-muted/50 text-sm text-muted-foreground"
                      >
                        {t("new.editorLoading")}
                      </div>
                    }
                  />
                </div>
              </div>
              ) : null}
              {jsonError && tab === "builtin" ? <p className="text-sm text-destructive">{jsonError}</p> : null}
              <Button
                type="button"
                disabled={createMut.isPending || !name.trim() || !builtinId || registry.length === 0}
                onClick={() => void handleCreateBuiltin()}
              >
                {createMut.isPending ? t("new.creating") : t("new.create")}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
