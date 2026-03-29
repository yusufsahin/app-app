import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useArtifacts, type Artifact } from "../../../shared/api/artifactApi";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui";
import { StartSuiteRunDialog } from "./StartSuiteRunDialog";
import { useStartSuiteRun } from "../hooks/useStartSuiteRun";
import { summarizeRunMetricsFromCustomFields } from "../lib/runMetrics";

type Props = {
  treeId?: string;
};

export function QualityRunsHubPanel({ treeId = "testsuites" }: Props) {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug, project } = useArtifactsPageProject();
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");

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

  const selectedSuite = selectedSuiteId ? suitesById.get(selectedSuiteId) : undefined;
  const defaultRunTitle =
    selectedSuite?.title != null && selectedSuite.title !== ""
      ? `${selectedSuite.title} — ${dayjs().format("YYYY-MM-DD HH:mm")}`
      : dayjs().format("YYYY-MM-DD HH:mm");

  const onConfirmNewRun = async (values: { title: string; description: string }) => {
    if (!selectedSuite?.parent_id) return;
    await startRun.mutateAsync({
      suiteId: selectedSuite.id,
      suiteParentId: selectedSuite.parent_id,
      title: values.title,
      description: values.description,
    });
    setNewRunOpen(false);
    setSelectedSuiteId("");
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">{t("runsHub.allRunsTitle")}</CardTitle>
              <CardDescription>{t("runsHub.allRunsDescription")}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
              <span className="text-sm font-medium">{t("runsHub.newRunSuiteLabel")}</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={selectedSuiteId} onValueChange={setSelectedSuiteId}>
                  <SelectTrigger className="w-full sm:min-w-[220px]" aria-label={t("runsHub.newRunSuiteLabel")}>
                    <SelectValue placeholder={t("runsHub.selectSuitePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(suitesQuery.data?.items ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title ?? s.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => setNewRunOpen(true)}
                  disabled={!selectedSuiteId || !selectedSuite?.parent_id || suitesQuery.isPending}
                >
                  {t("runsHub.newRun")}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {runsQuery.isPending ? (
            <p className="text-sm text-muted-foreground">{t("tree.loading")}</p>
          ) : (runsQuery.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("runsHub.emptyAllRuns")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("runsHub.colTitle")}</th>
                    <th className="px-3 py-2 font-medium">{t("runsHub.colUpdated")}</th>
                    <th className="px-3 py-2 font-medium">{t("runsHub.colEnvironment")}</th>
                    <th className="px-3 py-2 font-medium">{t("runsHub.colSummary")}</th>
                    <th className="px-3 py-2 font-medium">{t("runsHub.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(runsQuery.data?.items ?? []).map((run) => {
                    const cf = run.custom_fields as Record<string, unknown> | undefined;
                    const env =
                      (cf?.environment as string | undefined) ??
                      (cf?.Environment as string | undefined) ??
                      "—";
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
                    const parentId = run.parent_id;
                    const detailsTo =
                      parentId && /^[0-9a-f-]{36}$/i.test(parentId)
                        ? `/${orgSlug}/${projectSlug}/quality/runs?under=${encodeURIComponent(parentId)}&artifact=${encodeURIComponent(run.id)}`
                        : `/${orgSlug}/${projectSlug}/quality/runs?artifact=${encodeURIComponent(run.id)}`;

                    return (
                      <tr key={run.id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 font-medium">{run.title ?? run.id}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {run.updated_at ? dayjs(run.updated_at).format("YYYY-MM-DD HH:mm") : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{env}</td>
                        <td className="px-3 py-2 text-muted-foreground">{summaryLabel}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="secondary" size="sm" asChild>
                              <Link to={`/${orgSlug}/${projectSlug}/quality/runs/${run.id}/execute`}>
                                <PlayCircle className="mr-1 size-4" />
                                {t("runsHub.executeOrContinue")}
                              </Link>
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
