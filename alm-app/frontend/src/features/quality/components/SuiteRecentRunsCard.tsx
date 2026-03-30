import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import dayjs from "dayjs";
import { PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../../shared/api/client";
import type { Artifact } from "../../../shared/stores/artifactStore";
import { incomingRunForSuiteLinks, type ArtifactLink } from "../../../shared/api/artifactLinkApi";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "../../../shared/components/ui";
import { formatRunEnvironmentLabel, summarizeRunMetricsFromCustomFields } from "../lib/runMetrics";
import { qualityRunWorkspaceDetailPath } from "../lib/qualityRunPaths";
import { openManualRunnerInNewWindow } from "../lib/qualityOpenManualRunner";

const MAX_RECENT = 10;

type Props = {
  orgSlug: string;
  projectId: string;
  projectSlug: string;
  suiteId: string;
  links: ArtifactLink[] | undefined;
  linksLoading: boolean;
};

export function SuiteRecentRunsCard({ orgSlug, projectId, projectSlug, suiteId, links, linksLoading }: Props) {
  const { t } = useTranslation("quality");
  const incoming = incomingRunForSuiteLinks(links, suiteId);
  const runIds = incoming.slice(0, MAX_RECENT).map((l) => l.from_artifact_id);

  const runQueries = useQueries({
    queries: runIds.map((id) => ({
      queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", id] as const,
      queryFn: async (): Promise<Artifact> => {
        const { data } = await apiClient.get<Artifact>(
          `/orgs/${orgSlug}/projects/${projectId}/artifacts/${id}`,
        );
        return data;
      },
      enabled: !!orgSlug && !!projectId && !!id,
    })),
  });

  const loadingArtifacts = runQueries.some((q) => q.isPending);

  if (linksLoading) {
    return (
      <Card className="mt-4 w-full rounded-xl border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("runsHub.recentRunsTitle")}</CardTitle>
          <CardDescription>{t("runsHub.recentRunsLoadingHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2" role="status" aria-busy="true">
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (incoming.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 w-full rounded-xl border-border/80 bg-card/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("runsHub.recentRunsTitle")}</CardTitle>
        <CardDescription>{t("runsHub.recentRunsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loadingArtifacts ? (
          <div className="space-y-2" role="status" aria-busy="true">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ) : (
          runIds.map((runId, i) => {
            const artifact = runQueries[i]?.data;
            const cf = artifact?.custom_fields as Record<string, unknown> | undefined;
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
            const detailsTo = qualityRunWorkspaceDetailPath(orgSlug, projectSlug, runId, artifact?.parent_id);
            const titleText = artifact?.title ?? runId;
            const metaParts = [
              artifact?.updated_at ? dayjs(artifact.updated_at).format("YYYY-MM-DD HH:mm") : null,
              env !== "—" ? env : null,
              summaryLabel,
            ].filter(Boolean);

            return (
              <div
                key={runId}
                className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={titleText}>
                    {titleText}
                  </p>
                  <p className="text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    title={t("runsHub.executeInNewWindow")}
                    onClick={() => openManualRunnerInNewWindow(orgSlug, projectSlug, runId)}
                  >
                    <PlayCircle className="mr-1 size-4 shrink-0" aria-hidden />
                    {t("runsHub.executeOrContinue")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link to={detailsTo}>{t("runsHub.openDetails")}</Link>
                  </Button>
                </div>
              </div>
            );
          })
        )}
        {incoming.length > MAX_RECENT ? (
          <Button type="button" variant="link" className="h-auto px-0 pt-1" asChild>
            <Link to={`/${orgSlug}/${projectSlug}/quality/runs`}>{t("runsHub.viewAllRuns")}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
