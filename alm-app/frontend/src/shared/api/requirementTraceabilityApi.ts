import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export type TraceabilityMatrixColumn = {
  test_id: string;
  artifact_key: string | null;
  title: string;
};

export type TraceabilityMatrixCell = {
  test_id: string;
  linked: boolean;
  status: string | null;
  run_id: string | null;
  run_title: string | null;
};

export type TraceabilityMatrixRow = {
  requirement_id: string;
  parent_id: string | null;
  artifact_key: string | null;
  title: string;
  cells: TraceabilityMatrixCell[];
};

export type TraceabilityRelationship = {
  requirement_id: string;
  requirement_parent_id: string | null;
  requirement_artifact_key: string | null;
  requirement_title: string;
  test_id: string;
  test_artifact_key: string | null;
  test_title: string;
  link_type: string;
  status: string | null;
  run_id: string | null;
  run_title: string | null;
};

export type RequirementTraceabilityMatrixResponse = {
  computed_at: string;
  cache_hit: boolean;
  truncated: boolean;
  rows: TraceabilityMatrixRow[];
  columns: TraceabilityMatrixColumn[];
  relationships: TraceabilityRelationship[];
};

export type RequirementTraceabilityMatrixParams = {
  under?: string;
  linkTypes?: string;
  includeReverseVerifies?: boolean;
  scopeRunId?: string;
  scopeSuiteId?: string;
  scopeCampaignId?: string;
  search?: string;
  refresh?: boolean;
};

export async function fetchRequirementTraceabilityMatrix(
  orgSlug: string,
  projectId: string,
  params: RequirementTraceabilityMatrixParams = {},
): Promise<RequirementTraceabilityMatrixResponse> {
  const search = new URLSearchParams();
  if (params.under) search.set("under", params.under);
  if (params.linkTypes) search.set("link_types", params.linkTypes);
  if (params.includeReverseVerifies === false) search.set("include_reverse_verifies", "false");
  if (params.scopeRunId) search.set("scope_run_id", params.scopeRunId);
  if (params.scopeSuiteId) search.set("scope_suite_id", params.scopeSuiteId);
  if (params.scopeCampaignId) search.set("scope_campaign_id", params.scopeCampaignId);
  if (params.search?.trim()) search.set("search", params.search.trim());
  if (params.refresh) search.set("refresh", "true");
  const qs = search.toString();
  const url = `/orgs/${orgSlug}/projects/${projectId}/requirements/traceability-matrix${qs ? `?${qs}` : ""}`;
  const { data } = await apiClient.get<RequirementTraceabilityMatrixResponse>(url);
  return data;
}

export function useRequirementTraceabilityMatrix(
  orgSlug: string | undefined,
  projectId: string | undefined,
  params: RequirementTraceabilityMatrixParams,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "requirements", "traceability", params] as const,
    queryFn: () => fetchRequirementTraceabilityMatrix(orgSlug!, projectId!, params),
    enabled: !!orgSlug && !!projectId && enabled,
  });
}
