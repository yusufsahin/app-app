import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Copy, Download, Loader2, Pencil, Trash2 } from "lucide-react";
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import {
  useDeleteReportDefinition,
  useExecuteReportDefinition,
  useForkReportDefinition,
  usePublishReportDefinition,
  useReportDefinition,
  useValidateReportDefinition,
} from "../../../shared/api/reportDefinitionsApi";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { projectReportDetailPath, projectReportsPath } from "../../../shared/utils/appPaths";
import { ReportChartFromSpec } from "../components/ReportChartFromSpec";
import { ReportEditSheet } from "../components/ReportEditSheet";
import { ReportSqlEditor } from "../components/ReportSqlEditor";
import { ManifestEditor } from "../../../shared/components/ManifestEditor";
import { downloadReportCsv } from "../lib/downloadReportCsv";
import { REPORT_PREVIEW_ROW_LIMITS } from "../lib/previewRowLimits";
import { getReportApiErrorMessage, isApiErrorStatus } from "../lib/reportApiErrors";
import { formatDateTime } from "../../../shared/utils/formatDateTime";
import { DEFAULT_APP_DOCUMENT_TITLE } from "../lib/defaultDocumentTitle";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "../../../shared/components/ui";

export default function ProjectReportDetailPage() {
  const { t } = useTranslation("reports");
  const showNotification = useNotificationStore((s) => s.showNotification);
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const { orgSlug, projectSlug, project } = useBacklogWorkspaceProject();
  const projectId = project?.id;
  const user = useAuthStore((s) => s.user);

  const {
    data: def,
    isLoading: definitionLoading,
    isError: definitionError,
    error: definitionErr,
    refetch: refetchDefinition,
  } = useReportDefinition(orgSlug, projectId, reportId);
  const validateMut = useValidateReportDefinition(orgSlug, projectId);
  const publishMut = usePublishReportDefinition(orgSlug, projectId);
  const forkMut = useForkReportDefinition(orgSlug, projectId);
  const deleteMut = useDeleteReportDefinition(orgSlug, projectId);

  const [allowDraft, setAllowDraft] = useState(true);
  const [previewRowLimit, setPreviewRowLimit] = useState<number>(5000);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setPreviewRowLimit(5000);
  }, [reportId]);

  const {
    data: exec,
    isFetching: execLoading,
    refetch: refetchExec,
    isError: execError,
    error: execErr,
  } = useExecuteReportDefinition(orgSlug, projectId, reportId, {
    allowDraft,
    rowLimit: previewRowLimit,
    enabled: !!(orgSlug && projectId && reportId && def),
  });

  const isOwner = !!(def && user?.id && def.created_by_id && user.id === def.created_by_id);

  const chartSpecJson = useMemo(() => JSON.stringify(def?.chart_spec ?? {}, null, 2), [def]);
  const builtinParamsDisplay = useMemo(
    () => JSON.stringify(def?.builtin_parameters ?? {}, null, 2),
    [def],
  );

  useLayoutEffect(() => {
    const name = def?.name;
    if (name) {
      document.title = t("detail.browserTitle", { name });
    } else {
      document.title = DEFAULT_APP_DOCUMENT_TITLE;
    }
    return () => {
      document.title = DEFAULT_APP_DOCUMENT_TITLE;
    };
  }, [def?.id, def?.name, t]);

  if (!orgSlug || !projectSlug || !projectId || !reportId) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (definitionLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (definitionError) {
    const notFound = isApiErrorStatus(definitionErr, 404);
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-center text-sm">
        <p className={notFound ? "text-muted-foreground" : "text-destructive"}>
          {notFound ? t("detail.notFound") : getReportApiErrorMessage(definitionErr, t("detail.loadFailed"))}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {!notFound ? (
            <Button type="button" variant="secondary" onClick={() => void refetchDefinition()}>
              {t("detail.retry")}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to={projectReportsPath(orgSlug, projectSlug)}>{t("detail.back")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!def) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-center text-sm text-muted-foreground">
        {t("detail.notFound")}
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to={projectReportsPath(orgSlug, projectSlug)}>{t("detail.back")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-8 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={projectReportsPath(orgSlug, projectSlug)} className="gap-2">
            <ArrowLeft className="size-4" />
            {t("detail.back")}
          </Link>
        </Button>
        <BarChart3 className="size-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">{def.name}</h1>
        <Badge variant={def.lifecycle_status === "published" ? "default" : "secondary"}>{def.lifecycle_status}</Badge>
        {isOwner ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            {t("detail.edit")}
          </Button>
        ) : null}
      </div>

      {def.description ? <p className="text-sm text-muted-foreground">{def.description}</p> : null}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t("detail.metaDefinitionKind")}: <span className="text-foreground/90">{def.query_kind}</span>
        </span>
        <span>
          {t("detail.metaVisibility")}: <span className="text-foreground/90">{def.visibility}</span>
        </span>
        {def.catalog_key ? (
          <span>
            {t("detail.metaCatalog")}: <span className="font-mono text-foreground/90">{def.catalog_key}</span>
          </span>
        ) : null}
        {def.updated_at ? (
          <span>
            {t("detail.metaUpdated")}: <span className="text-foreground/90">{formatDateTime(def.updated_at)}</span>
          </span>
        ) : null}
      </div>

      <ReportEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        orgSlug={orgSlug}
        projectId={projectId}
        reportId={reportId}
        definition={def}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("detail.lifecycleTitle")}</CardTitle>
          <CardDescription className="space-y-2">
            <span className="block">{t("detail.lifecycleHint")}</span>
            {!isOwner ? <span className="block text-foreground/90">{t("detail.forkToCustomizeHint")}</span> : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            title={!isOwner ? t("detail.ownerOnlyLifecycle") : undefined}
            disabled={validateMut.isPending || !isOwner}
            onClick={async () => {
              try {
                const updated = await validateMut.mutateAsync(reportId);
                void refetchExec();
                if (updated.last_validation_ok) {
                  showNotification(updated.last_validation_message || t("detail.validatedOk"), "success");
                } else {
                  showNotification(updated.last_validation_message || t("detail.validateFailed"), "error");
                }
              } catch (err) {
                showNotification(getReportApiErrorMessage(err, t("detail.validateFailed")), "error");
              }
            }}
          >
            {validateMut.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {validateMut.isPending ? t("detail.validating") : t("detail.validate")}
          </Button>
          <Button
            type="button"
            title={!isOwner ? t("detail.ownerOnlyLifecycle") : undefined}
            disabled={publishMut.isPending || !def.last_validation_ok || !isOwner}
            onClick={async () => {
              try {
                await publishMut.mutateAsync(reportId);
                void refetchExec();
                showNotification(t("detail.publishedOk"), "success");
              } catch (err) {
                showNotification(getReportApiErrorMessage(err, t("detail.publishFailed")), "error");
              }
            }}
          >
            {publishMut.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {publishMut.isPending ? t("detail.publishing") : t("detail.publish")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={forkMut.isPending}
            onClick={async () => {
              try {
                const forkName = t("detail.forkCopySuffix", { name: def.name });
                const copy = await forkMut.mutateAsync({ sourceId: reportId, name: forkName });
                showNotification(t("detail.forkedOk"), "success");
                navigate(projectReportDetailPath(orgSlug, projectSlug, copy.id));
              } catch (err) {
                showNotification(getReportApiErrorMessage(err, t("detail.forkFailed")), "error");
              }
            }}
          >
            <Copy className="mr-2 size-4" />
            {t("detail.fork")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            title={!isOwner ? t("detail.ownerOnlyLifecycle") : undefined}
            disabled={deleteMut.isPending || !isOwner}
            onClick={async () => {
              if (!window.confirm(t("detail.deleteConfirm"))) return;
              try {
                await deleteMut.mutateAsync(reportId);
                showNotification(t("detail.deletedOk"), "success");
                navigate(projectReportsPath(orgSlug, projectSlug));
              } catch (err) {
                showNotification(getReportApiErrorMessage(err, t("detail.deleteFailed")), "error");
              }
            }}
          >
            <Trash2 className="mr-2 size-4" />
            {deleteMut.isPending ? t("detail.deleting") : t("detail.delete")}
          </Button>
        </CardContent>
        {def.last_validation_message ? (
          <CardContent className="pt-0 text-sm text-muted-foreground">{def.last_validation_message}</CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-lg">{t("detail.previewTitle")}</CardTitle>
            <CardDescription>{t("detail.previewHint")}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowDraft}
                onChange={(e) => setAllowDraft(e.target.checked)}
                className="rounded border-input"
              />
              {t("detail.allowDraft")}
            </label>
            <div className="flex items-center gap-2">
              <Label htmlFor="preview-row-limit" className="whitespace-nowrap text-sm text-muted-foreground">
                {t("detail.previewRowLimit")}
              </Label>
              <Select
                value={String(previewRowLimit)}
                onValueChange={(v) => setPreviewRowLimit(Number(v))}
                disabled={execLoading}
              >
                <SelectTrigger id="preview-row-limit" className="h-8 w-[110px]">
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
            <Button type="button" variant="outline" size="sm" disabled={execLoading} onClick={() => refetchExec()}>
              {execLoading ? <Loader2 className="size-4 animate-spin" /> : t("detail.refresh")}
            </Button>
            {exec && exec.columns.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadReportCsv(def.name, exec.columns, exec.rows)}
              >
                <Download className="mr-2 size-4" />
                {t("detail.exportCsv")}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {execLoading && !exec ? (
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
          ) : execError ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{getReportApiErrorMessage(execErr, t("detail.previewFailed"))}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchExec()}>
                {t("detail.retry")}
              </Button>
            </div>
          ) : exec ? (
            <>
              <ReportChartFromSpec chartSpec={exec.chart_spec} rows={exec.rows} columns={exec.columns} />
              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground">
                {t("detail.metaQueryKind")}: {exec.query_kind} · {t("detail.rowCount", { count: exec.rows.length })}
                {exec.row_limit != null ? ` · ${t("detail.rowLimit", { limit: exec.row_limit })}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("detail.noPreview")}</p>
          )}
        </CardContent>
      </Card>

      {def.sql_text ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("detail.sqlTitle")}</CardTitle>
            <CardDescription>{t("detail.sqlHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportSqlEditor value={def.sql_text} readOnly height={320} />
          </CardContent>
        </Card>
      ) : null}

      {def.query_kind === "sql" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("detail.chartSpecTitle")}</CardTitle>
            <CardDescription>{t("detail.chartSpecReadonlyHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ManifestEditor
              value={chartSpecJson}
              readOnly
              language="json"
              height={220}
              loadingPlaceholder={
                <div
                  style={{ height: 220 }}
                  className="flex items-center justify-center bg-muted/50 text-sm text-muted-foreground"
                >
                  {t("new.editorLoading")}
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {def.query_kind === "builtin" && def.builtin_report_id ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("detail.builtinTitle")}</CardTitle>
            <CardDescription>{t("detail.builtinHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("detail.builtinIdLabel")}</p>
              <p className="font-mono text-sm">{def.builtin_report_id}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("detail.builtinParamsReadonly")}</p>
              <ManifestEditor
                value={builtinParamsDisplay}
                readOnly
                language="json"
                height={200}
                loadingPlaceholder={
                  <div
                    style={{ height: 200 }}
                    className="flex items-center justify-center bg-muted/50 text-sm text-muted-foreground"
                  >
                    {t("new.editorLoading")}
                  </div>
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
