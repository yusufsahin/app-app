import { api } from './client';

export interface ArtifactTraceabilitySummary {
  artifact_id: string;
  artifact_key: string | null;
  environments: Array<{
    environment: string;
    last_occurred_at: string;
    commit_sha: string | null;
    source: string;
  }>;
  scm_links: Array<{
    web_url: string;
    commit_sha: string | null;
    provider: string;
    title: string | null;
  }>;
}

export async function fetchArtifactTraceabilitySummary(
  orgSlug: string,
  projectId: string,
  artifactId: string,
): Promise<ArtifactTraceabilitySummary> {
  const { data } = await api.get<ArtifactTraceabilitySummary>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/traceability-summary`,
  );
  return data;
}
