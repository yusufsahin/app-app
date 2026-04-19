/**
 * Artifact traceability summary: deployment events + SCM links aggregate.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface TraceabilityEnvironmentItem {
  environment: string;
  last_occurred_at: string;
  commit_sha: string | null;
  image_digest: string | null;
  release_label: string | null;
  build_id: string | null;
  source: string;
  matched_via: "artifact_key" | "commit_sha";
  deployment_event_id: string;
}

export interface TraceabilityScmLinkSummaryItem {
  web_url: string;
  commit_sha: string | null;
  provider: string;
  title: string | null;
  key_match_source?: string | null;
}

export interface ArtifactTraceabilitySummary {
  artifact_id: string;
  artifact_key: string | null;
  environments: TraceabilityEnvironmentItem[];
  scm_links: TraceabilityScmLinkSummaryItem[];
}

export function traceabilitySummaryQueryKey(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "traceability-summary"] as const;
}

export function useArtifactTraceabilitySummary(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: traceabilitySummaryQueryKey(orgSlug, projectId, artifactId),
    queryFn: async (): Promise<ArtifactTraceabilitySummary> => {
      const { data } = await apiClient.get<ArtifactTraceabilitySummary>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/traceability-summary`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}
