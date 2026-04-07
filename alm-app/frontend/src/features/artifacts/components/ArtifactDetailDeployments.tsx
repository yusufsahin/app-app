import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { useArtifactTraceabilitySummary } from "../../../shared/api/traceabilityApi";
import type { ProblemDetail } from "../../../shared/api/types";
import { formatDateTime } from "../utils";

function isProblemDetail(e: unknown): e is ProblemDetail {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    typeof (e as ProblemDetail).status === "number"
  );
}

interface ArtifactDetailDeploymentsProps {
  orgSlug: string | undefined;
  projectId: string | undefined;
  artifactId: string;
}

export function ArtifactDetailDeployments({
  orgSlug,
  projectId,
  artifactId,
}: ArtifactDetailDeploymentsProps) {
  const { t } = useTranslation("quality");
  const { data, isLoading, isError, error } = useArtifactTraceabilitySummary(
    orgSlug,
    projectId,
    artifactId,
  );

  if (!orgSlug || !projectId) {
    return <p className="text-sm text-muted-foreground">{t("workItemDetail.deploy.needProject")}</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("workItemDetail.deploy.loading")}</p>;
  }

  if (isError) {
    if (isProblemDetail(error) && error.status === 403) {
      return <p className="text-sm text-muted-foreground">{t("workItemDetail.deploy.noPermission")}</p>;
    }
    const msg = error instanceof Error ? error.message : t("workItemDetail.deploy.loadError");
    return <p className="text-sm text-destructive">{msg}</p>;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-medium">{t("workItemDetail.deploy.environmentsTitle")}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t("workItemDetail.deploy.environmentsIntro")}</p>
        {data.environments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("workItemDetail.deploy.noEnvironments")}</p>
        ) : (
          <ul className="space-y-3">
            {data.environments.map((e) => (
              <li
                key={`${e.environment}-${e.deployment_event_id}`}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.environment}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(e.last_occurred_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("workItemDetail.deploy.matchedVia", { via: e.matched_via })}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {e.commit_sha && (
                    <span>
                      {t("workItemDetail.deploy.commit")}: {e.commit_sha.slice(0, 12)}
                    </span>
                  )}
                  {e.image_digest && (
                    <span>
                      {t("workItemDetail.deploy.image")}: {e.image_digest.slice(0, 24)}…
                    </span>
                  )}
                  {e.release_label && (
                    <span>
                      {t("workItemDetail.deploy.release")}: {e.release_label}
                    </span>
                  )}
                  {e.build_id && (
                    <span>
                      {t("workItemDetail.deploy.build")}: {e.build_id}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">{t("workItemDetail.deploy.scmLinksTitle")}</h3>
        {data.scm_links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("workItemDetail.deploy.noScmLinks")}</p>
        ) : (
          <ul className="space-y-2">
            {data.scm_links.map((link, i) => (
              <li key={`${link.web_url}-${i}`} className="flex items-start gap-2 text-sm">
                <a
                  href={link.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  {link.title || link.web_url}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                </a>
                <span className="text-xs text-muted-foreground">
                  {link.provider}
                  {link.commit_sha ? ` · ${link.commit_sha.slice(0, 7)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
