import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { useArtifact } from "../../../shared/api/artifactApi";
import { incomingRunForSuiteRelationships, useArtifactRelationships } from "../../../shared/api/relationshipApi";
import { Badge, Button } from "../../../shared/components/ui";
import { navigateToRunDetails } from "../lib/qualityOpenManualRunner";
import {
  parseRunMetricsPayload,
  summarizeRunMetrics,
  type TestExecutionResultRow,
} from "../lib/runMetrics";
import { compareRunResultRows, diffRunMetricSummaries, isZeroSummaryDelta } from "../lib/runMetricsCompare";

type Props = {
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  runArtifactId: string;
  currentResults: TestExecutionResultRow[];
};

function executionStatusTKey(status: string | null | undefined): "passed" | "failed" | "blocked" | "notExecuted" {
  if (status === "passed" || status === "failed" || status === "blocked") return status;
  return "notExecuted";
}

export function RunPreviousCompareSection({
  orgSlug,
  projectSlug,
  projectId,
  runArtifactId,
  currentResults,
}: Props) {
  const { t } = useTranslation("quality");
  const navigate = useNavigate();

  const runLinksQuery = useArtifactRelationships(orgSlug, projectId, runArtifactId);
  const suiteId = useMemo(
    () =>
      runLinksQuery.data?.find(
        (relationship) =>
          relationship.relationship_type === "run_for_suite" && relationship.direction === "outgoing",
      )?.target_artifact_id,
    [runLinksQuery.data],
  );

  const suiteLinksQuery = useArtifactRelationships(orgSlug, projectId, suiteId);

  const previousRunId = useMemo(() => {
    if (!suiteId || !suiteLinksQuery.data?.length) return undefined;
    const peers = [...incomingRunForSuiteRelationships(suiteLinksQuery.data, suiteId)].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
    const idx = peers.findIndex((relationship) => relationship.source_artifact_id === runArtifactId);
    if (idx < 0 || idx >= peers.length - 1) return undefined;
    return peers[idx + 1]?.source_artifact_id;
  }, [suiteId, suiteLinksQuery.data, runArtifactId]);

  const prevArtifactQuery = useArtifact(orgSlug, projectId, previousRunId);

  if (runLinksQuery.isPending) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm text-muted-foreground" data-testid="quality-run-compare-section">
        {t("runsHub.compareWithPreviousLoading")}
      </div>
    );
  }

  if (!suiteId) {
    return null;
  }

  if (suiteLinksQuery.isPending) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm text-muted-foreground" data-testid="quality-run-compare-section">
        {t("runsHub.compareWithPreviousLoading")}
      </div>
    );
  }

  if (!previousRunId) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm text-muted-foreground" data-testid="quality-run-compare-section">
        <p className="font-medium text-foreground">{t("runsHub.compareWithPreviousTitle")}</p>
        <p className="mt-1">{t("runsHub.compareNoPreviousRun")}</p>
      </div>
    );
  }

  if (prevArtifactQuery.isPending) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm text-muted-foreground" data-testid="quality-run-compare-section">
        {t("runsHub.compareWithPreviousLoading")}
      </div>
    );
  }

  if (prevArtifactQuery.isError || !prevArtifactQuery.data) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm text-destructive" data-testid="quality-run-compare-section">
        {t("runsHub.comparePreviousLoadError")}
      </div>
    );
  }

  const prevCf = prevArtifactQuery.data.custom_fields as Record<string, unknown> | undefined;
  const prevResults = parseRunMetricsPayload(prevCf?.run_metrics_json) ?? [];
  const prevSummary = summarizeRunMetrics(prevResults);
  const currSummary = summarizeRunMetrics(currentResults);
  const delta = diffRunMetricSummaries(prevSummary, currSummary);
  const rows = compareRunResultRows(prevResults, currentResults);
  const stable = rows.length === 0 && isZeroSummaryDelta(delta);

  const formatDelta = (n: number) => (n > 0 ? `+${n}` : String(n));

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3" data-testid="quality-run-compare-section">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{t("runsHub.compareWithPreviousTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("runsHub.compareWithPreviousHint")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigateToRunDetails(navigate, orgSlug, projectSlug, previousRunId)}
        >
          {t("runsHub.compareOpenPrevious")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{t("runsHub.comparePreviousRunLabel")}</span>{" "}
        {prevArtifactQuery.data.title ?? previousRunId.slice(0, 8)}
        {prevArtifactQuery.data.updated_at ? (
          <span> · {dayjs(prevArtifactQuery.data.updated_at).format("YYYY-MM-DD HH:mm")}</span>
        ) : null}
      </p>
      <div className="grid gap-1 text-xs sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">{t("runsHub.modalPassed", { count: currSummary.passed })}</span>{" "}
          <span className={delta.passed === 0 ? "text-muted-foreground" : delta.passed > 0 ? "text-emerald-600" : "text-destructive"}>
            ({formatDelta(delta.passed)})
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">{t("runsHub.modalFailed", { count: currSummary.failed })}</span>{" "}
          <span className={delta.failed === 0 ? "text-muted-foreground" : delta.failed < 0 ? "text-emerald-600" : "text-destructive"}>
            ({formatDelta(delta.failed)})
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">{t("runsHub.modalBlocked", { count: currSummary.blocked })}</span>{" "}
          <span className="text-muted-foreground">({formatDelta(delta.blocked)})</span>
        </p>
        <p>
          <span className="text-muted-foreground">{t("runsHub.modalNotRun", { count: currSummary.notExecuted })}</span>{" "}
          <span className="text-muted-foreground">({formatDelta(delta.notExecuted)})</span>
        </p>
      </div>
      {stable ? (
        <p className="text-sm text-muted-foreground">{t("runsHub.compareStable")}</p>
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto">
          <p className="mb-2 text-xs font-medium text-foreground">{t("runsHub.compareChangesHeading")}</p>
          <table className="w-full min-w-[280px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="py-1 pr-2 font-medium">{t("runsHub.compareColTest")}</th>
                <th className="py-1 pr-2 font-medium">{t("runsHub.compareColPrevious")}</th>
                <th className="py-1 font-medium">{t("runsHub.compareColCurrent")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/40">
                  <td className="py-1.5 pr-2 align-top">
                    <span className="mr-1 font-mono text-[10px] text-muted-foreground">#{r.displayIndex}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.kind === "changed"
                        ? t("runsHub.compareKindChanged")
                        : r.kind === "new"
                          ? t("runsHub.compareKindNew")
                          : t("runsHub.compareKindRemoved")}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-2 align-top">
                    {r.previous != null ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`execution.lastExecution.${executionStatusTKey(r.previous)}`)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-1.5 align-top">
                    {r.current != null ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`execution.lastExecution.${executionStatusTKey(r.current)}`)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
