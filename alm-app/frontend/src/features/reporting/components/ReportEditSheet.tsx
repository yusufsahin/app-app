import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReportDefinition, UpdateReportDefinitionBody } from "../../../shared/api/reportDefinitionsApi";
import { useUpdateReportDefinition } from "../../../shared/api/reportDefinitionsApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { getReportApiErrorMessage } from "../lib/reportApiErrors";
import { jsonParseErrorLine } from "../lib/jsonParseErrorLine";
import { ManifestEditor } from "../../../shared/components/ManifestEditor";
import { ReportSqlEditor } from "./ReportSqlEditor";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../../../shared/components/ui";

export interface ReportEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  projectId: string;
  reportId: string;
  definition: ReportDefinition;
}

export function ReportEditSheet({
  open,
  onOpenChange,
  orgSlug,
  projectId,
  reportId,
  definition,
}: ReportEditSheetProps) {
  const { t } = useTranslation("reports");
  const showNotification = useNotificationStore((s) => s.showNotification);
  const updateMut = useUpdateReportDefinition(orgSlug, projectId);

  const [name, setName] = useState(definition.name);
  const [description, setDescription] = useState(definition.description);
  const [visibility, setVisibility] = useState(definition.visibility);
  const [sqlText, setSqlText] = useState(definition.sql_text ?? "");
  const [chartSpecJson, setChartSpecJson] = useState(() => JSON.stringify(definition.chart_spec ?? {}, null, 2));
  const [builtinParamsJson, setBuiltinParamsJson] = useState(() =>
    JSON.stringify(definition.builtin_parameters ?? {}, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [chartSpecErrorLine, setChartSpecErrorLine] = useState<number | undefined>();
  const [builtinParamsErrorLine, setBuiltinParamsErrorLine] = useState<number | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(definition.name);
    setDescription(definition.description);
    setVisibility(definition.visibility);
    setSqlText(definition.sql_text ?? "");
    setChartSpecJson(JSON.stringify(definition.chart_spec ?? {}, null, 2));
    setBuiltinParamsJson(JSON.stringify(definition.builtin_parameters ?? {}, null, 2));
    setJsonError(null);
    setChartSpecErrorLine(undefined);
    setBuiltinParamsErrorLine(undefined);
  }, [open, definition]);

  const handleSave = async () => {
    setJsonError(null);
    let chart_spec: Record<string, unknown> | undefined;
    let builtin_parameters: Record<string, unknown> | undefined;

    if (definition.query_kind === "sql") {
      try {
        chart_spec = chartSpecJson.trim() ? (JSON.parse(chartSpecJson) as Record<string, unknown>) : {};
      } catch (e) {
        setChartSpecErrorLine(jsonParseErrorLine(e));
        setJsonError(t("new.invalidJson"));
        return;
      }
    } else {
      try {
        builtin_parameters = builtinParamsJson.trim()
          ? (JSON.parse(builtinParamsJson) as Record<string, unknown>)
          : {};
      } catch (e) {
        setBuiltinParamsErrorLine(jsonParseErrorLine(e));
        setJsonError(t("new.invalidJson"));
        return;
      }
    }

    const body: UpdateReportDefinitionBody = {
      name: name.trim() || definition.name,
      description: description.trim(),
      visibility,
    };
    if (definition.query_kind === "sql") {
      body.sql_text = sqlText.trim();
      body.chart_spec = chart_spec ?? {};
    } else {
      body.builtin_parameters = builtin_parameters ?? {};
    }

    try {
      await updateMut.mutateAsync({ reportId, body });
      showNotification(t("detail.updatedOk"), "success");
      onOpenChange(false);
    } catch (err) {
      showNotification(getReportApiErrorMessage(err, t("detail.updateFailed")), "error");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("detail.editTitle")}</SheetTitle>
          <SheetDescription>{definition.query_kind === "sql" ? t("new.sqlHint") : t("new.builtinParamsJson")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-report-name">{t("new.name")}</Label>
            <Input id="edit-report-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-report-desc">{t("new.description")}</Label>
            <Input id="edit-report-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-report-visibility">{t("new.visibility")}</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger id="edit-report-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">{t("new.visibilityPrivate")}</SelectItem>
                <SelectItem value="project">{t("new.visibilityProject")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {definition.query_kind === "sql" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-report-sql">{t("new.sqlLabel")}</Label>
                <div id="edit-report-sql">
                  <ReportSqlEditor value={sqlText} onChange={setSqlText} height={260} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-chart-spec">{t("new.chartSpecJson")}</Label>
                <div id="edit-chart-spec">
                  <ManifestEditor
                    value={chartSpecJson}
                    onChange={(v) => {
                      setChartSpecJson(v);
                      setChartSpecErrorLine(undefined);
                    }}
                    language="json"
                    height={200}
                    errorLine={chartSpecErrorLine}
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
                <p className="text-xs text-muted-foreground">{t("new.chartSpecHint")}</p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="edit-builtin-params">{t("new.builtinParamsJson")}</Label>
              <div id="edit-builtin-params">
                <ManifestEditor
                  value={builtinParamsJson}
                  onChange={(v) => {
                    setBuiltinParamsJson(v);
                    setBuiltinParamsErrorLine(undefined);
                  }}
                  language="json"
                  height={220}
                  errorLine={builtinParamsErrorLine}
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
            </div>
          )}

          {jsonError ? <p className="text-sm text-destructive">{jsonError}</p> : null}
        </div>

        <SheetFooter className="gap-2 sm:flex-col">
          <Button type="button" onClick={() => void handleSave()} disabled={updateMut.isPending}>
            {updateMut.isPending ? t("detail.saving") : t("detail.editSave")}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("detail.editCancel")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
