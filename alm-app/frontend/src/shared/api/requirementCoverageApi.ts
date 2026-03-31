import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export type RequirementCoverageTestRef = {
  test_id: string;
  status: string | null;
  run_id: string | null;
  run_title: string | null;
};

export type RequirementCoverageLeaf = {
  id: string;
  parent_id: string | null;
  title: string;
  artifact_key: string | null;
  leaf_status: string;
  verifying_test_ids: string[];
  tests: RequirementCoverageTestRef[];
};

export type RequirementCoverageNode = {
  id: string;
  parent_id: string | null;
  title: string;
  artifact_key: string | null;
  artifact_type: string;
  direct_status: string;
  subtree_counts: Record<string, number>;
};

export type RequirementCoverageAnalysisResponse = {
  computed_at: string;
  cache_hit: boolean;
  nodes: RequirementCoverageNode[];
  leaves: RequirementCoverageLeaf[];
};

export type RequirementCoverageParams = {
  under?: string;
  linkTypes?: string;
  includeReverseVerifies?: boolean;
  scopeRunId?: string;
  scopeSuiteId?: string;
  scopeCampaignId?: string;
  refresh?: boolean;
};

export async function fetchRequirementCoverageAnalysis(
  orgSlug: string,
  projectId: string,
  params: RequirementCoverageParams = {},
): Promise<RequirementCoverageAnalysisResponse> {
  const search = new URLSearchParams();
  if (params.under) search.set("under", params.under);
  if (params.linkTypes) search.set("link_types", params.linkTypes);
  if (params.includeReverseVerifies === false) search.set("include_reverse_verifies", "false");
  if (params.scopeRunId) search.set("scope_run_id", params.scopeRunId);
  if (params.scopeSuiteId) search.set("scope_suite_id", params.scopeSuiteId);
  if (params.scopeCampaignId) search.set("scope_campaign_id", params.scopeCampaignId);
  if (params.refresh) search.set("refresh", "true");
  const qs = search.toString();
  const url = `/orgs/${orgSlug}/projects/${projectId}/requirements/coverage-analysis${qs ? `?${qs}` : ""}`;
  const { data } = await apiClient.get<RequirementCoverageAnalysisResponse>(url);
  return data;
}

export function useRequirementCoverageAnalysis(
  orgSlug: string | undefined,
  projectId: string | undefined,
  params: RequirementCoverageParams,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "requirements", "coverage", params] as const,
    queryFn: () => fetchRequirementCoverageAnalysis(orgSlug!, projectId!, params),
    enabled: !!orgSlug && !!projectId && enabled,
  });
}
