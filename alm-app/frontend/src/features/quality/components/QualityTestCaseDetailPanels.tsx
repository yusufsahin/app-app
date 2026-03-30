import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PhoneForwarded } from "lucide-react";
import { useAllQualityTestCases, type Artifact } from "../../../shared/api/artifactApi";
import type { ArtifactLink } from "../../../shared/api/artifactLinkApi";
import { apiClient } from "../../../shared/api/client";
import { useOrgMembers } from "../../../shared/api/orgApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui/tabs";
import { Button } from "../../../shared/components/ui";
import { ArtifactCommentsPanel } from "../../../shared/components/comments";
import { useAuthStore } from "../../../shared/stores/authStore";
import { hasPermission } from "../../../shared/utils/permissions";
import { qualityTraceabilityPath, qualityCatalogArtifactPath } from "../../../shared/utils/appPaths";
import { parseTestPlan } from "../lib/testPlan";
import { isTestPlanCall } from "../types";

const MAX_LINK_TARGET_QUERIES = 20;

function planReferencesCallee(artifact: Artifact, calleeId: string): boolean {
  for (const e of parseTestPlan(
    (artifact.custom_fields as Record<string, unknown> | undefined)?.test_steps_json,
  )) {
    if (isTestPlanCall(e) && e.calledTestCaseId === calleeId) return true;
  }
  return false;
}

interface QualityTestCaseDetailPanelsProps {
  artifact: Artifact;
  orgSlug: string | undefined;
  projectId: string | undefined;
  projectSlug: string | undefined;
  enableStepsEditor: boolean;
  links: ArtifactLink[] | undefined;
  linksLoading: boolean;
}

export function QualityTestCaseDetailPanels({
  artifact,
  orgSlug,
  projectId,
  projectSlug,
  enableStepsEditor,
  links,
  linksLoading,
}: QualityTestCaseDetailPanelsProps) {
  const { t } = useTranslation("quality");
  const { data: members } = useOrgMembers(orgSlug);
  const permissions = useAuthStore((s) => s.permissions);
  const canCommentArtifact = hasPermission(permissions, "artifact:comment");

  const planEntries = useMemo(
    () => parseTestPlan((artifact.custom_fields as Record<string, unknown> | undefined)?.test_steps_json),
    [artifact.custom_fields],
  );

  const calleeIds = useMemo(
    () => [...new Set(planEntries.filter(isTestPlanCall).map((c) => c.calledTestCaseId))].slice(0, MAX_LINK_TARGET_QUERIES),
    [planEntries],
  );

  const { data: catalogCases } = useAllQualityTestCases(orgSlug, projectId);

  const callers = useMemo(() => {
    const items = catalogCases?.items ?? [];
    return items.filter((a) => a.id !== artifact.id && planReferencesCallee(a, artifact.id));
  }, [catalogCases?.items, artifact.id]);

  const showStepsSection = enableStepsEditor || planEntries.length > 0;

  const targetIds = useMemo(() => {
    const unique = [...new Set((links ?? []).map((l) => l.to_artifact_id))];
    return unique.slice(0, MAX_LINK_TARGET_QUERIES);
  }, [links]);

  const calleeFetchIds = useMemo(() => {
    const merged = [...new Set([...targetIds, ...calleeIds])];
    return merged.slice(0, MAX_LINK_TARGET_QUERIES);
  }, [targetIds, calleeIds]);

  const targetResults = useQueries({
    queries: calleeFetchIds.map((id) => ({
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

  const targetTitleById = useMemo(() => {
    const map = new Map<string, string>();
    calleeFetchIds.forEach((id, i) => {
      const data = targetResults[i]?.data;
      if (data?.title) map.set(id, data.title);
    });
    return map;
  }, [calleeFetchIds, targetResults]);

  const parentFolderIdByFetchedArtifactId = useMemo(() => {
    const map = new Map<string, string | null>();
    calleeFetchIds.forEach((id, i) => {
      map.set(id, targetResults[i]?.data?.parent_id ?? null);
    });
    return map;
  }, [calleeFetchIds, targetResults]);

  const traceabilityLink =
    orgSlug && projectSlug ? qualityTraceabilityPath(orgSlug, projectSlug) : null;

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {showStepsSection ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{t("steps.title")}</h4>
          {planEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("steps.empty")}</p>
          ) : (
            <ol className="list-decimal space-y-3 pl-4 text-sm">
              {planEntries.map((entry) =>
                isTestPlanCall(entry) ? (
                  <li key={entry.id} className="pl-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      <PhoneForwarded className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span>{t("steps.callStep")}</span>
                      {orgSlug && projectSlug ? (
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          to={qualityCatalogArtifactPath(
                            orgSlug,
                            projectSlug,
                            entry.calledTestCaseId,
                            parentFolderIdByFetchedArtifactId.get(entry.calledTestCaseId) ?? undefined,
                          )}
                        >
                          {entry.calledTitle ??
                            targetTitleById.get(entry.calledTestCaseId) ??
                            `${t("detail.linkTargetUnknown")} (${entry.calledTestCaseId.slice(0, 8)}…)`}
                        </Link>
                      ) : (
                        <span>
                          {entry.calledTitle ??
                            targetTitleById.get(entry.calledTestCaseId) ??
                            entry.calledTestCaseId.slice(0, 8) + "…"}
                        </span>
                      )}
                    </div>
                    {entry.paramOverrides && Object.keys(entry.paramOverrides).length > 0 ? (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {JSON.stringify(entry.paramOverrides)}
                      </p>
                    ) : null}
                  </li>
                ) : (
                  <li key={entry.id} className="pl-1">
                    <div className="font-medium text-foreground">{entry.name || t("steps.noName")}</div>
                    {entry.description ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{entry.description}</p>
                    ) : null}
                    {entry.expectedResult ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium">{t("steps.fields.expectedResult")}:</span>{" "}
                        {entry.expectedResult}
                      </p>
                    ) : null}
                  </li>
                ),
              )}
            </ol>
          )}
          {callers.length > 0 ? (
            <div className="mt-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">{t("detail.callersHeading")}</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                {callers.map((c) => (
                  <li key={c.id}>
                    {orgSlug && projectSlug ? (
                      <Link
                        className="text-primary underline-offset-4 hover:underline"
                        to={qualityCatalogArtifactPath(orgSlug, projectSlug, c.id, c.parent_id ?? undefined)}
                      >
                        {c.title ?? c.id.slice(0, 8) + "…"}
                      </Link>
                    ) : (
                      <span>{c.title ?? c.id}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Tabs defaultValue="traceability" className="w-full">
        <TabsList className="h-9 w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="traceability" data-testid="quality-detail-tab-traceability" className="text-xs sm:text-sm">
            {t("detail.tabs.traceability")}
          </TabsTrigger>
          <TabsTrigger value="attachments" data-testid="quality-detail-tab-attachments" className="text-xs sm:text-sm">
            {t("detail.tabs.attachments")}
          </TabsTrigger>
          <TabsTrigger value="comments" data-testid="quality-detail-tab-comments" className="text-xs sm:text-sm">
            {t("detail.tabs.comments")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="traceability" className="mt-3 text-sm">
          {linksLoading ? (
            <p className="text-muted-foreground">{t("detail.traceabilityLoading")}</p>
          ) : !links?.length ? (
            <p className="text-muted-foreground">{t("detail.traceabilityEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => {
                const title = targetTitleById.get(link.to_artifact_id);
                const label =
                  title ??
                  `${t("detail.linkTargetUnknown")} (${link.to_artifact_id.slice(0, 8)}…)`;
                return (
                  <li
                    key={link.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <span className="min-w-0 font-medium">{label}</span>
                    <code className="shrink-0 text-xs text-muted-foreground">{link.link_type}</code>
                  </li>
                );
              })}
            </ul>
          )}
          {traceabilityLink ? (
            <Button variant="link" size="sm" className="mt-3 h-auto px-0" asChild>
              <Link to={traceabilityLink}>{t("detail.traceabilityOpenFull")}</Link>
            </Button>
          ) : null}
        </TabsContent>
        <TabsContent value="attachments" className="mt-3 text-sm text-muted-foreground">
          {t("detail.attachmentsPlaceholder")}
        </TabsContent>
        <TabsContent value="comments" className="mt-3 text-sm">
          <ArtifactCommentsPanel
            orgSlug={orgSlug}
            projectId={projectId}
            artifactId={artifact.id}
            members={members}
            canComment={canCommentArtifact}
            labels={{
              heading: t("detail.commentsHeading"),
              emptyList: t("detail.commentsEmpty"),
              placeholder: t("detail.commentsFieldPlaceholder"),
              submit: t("detail.commentsSubmit"),
              unknownAuthor: t("detail.commentsUnknownAuthor"),
              added: t("detail.commentsAdded"),
              failed: t("detail.commentsFailed"),
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
