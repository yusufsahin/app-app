/**
 * Saved queries API: list, create, update, delete, run (artifact list by saved filters).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { Artifact } from "../stores/artifactStore";

export interface SavedQuery {
  id: string;
  project_id: string;
  name: string;
  owner_id: string;
  visibility: "private" | "project";
  filter_params: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface SavedQueryCreateRequest {
  name: string;
  filter_params: Record<string, unknown>;
  visibility?: "private" | "project";
}

export interface SavedQueryUpdateRequest {
  name?: string;
  filter_params?: Record<string, unknown>;
  visibility?: "private" | "project";
}

export interface ArtifactsListResult {
  items: Artifact[];
  total: number;
}

export function useSavedQueries(orgSlug: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "saved-queries"],
    queryFn: async (): Promise<SavedQuery[]> => {
      const { data } = await apiClient.get<SavedQuery[]>(
        `/orgs/${orgSlug}/projects/${projectId}/saved-queries`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useCreateSavedQuery(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SavedQueryCreateRequest): Promise<SavedQuery> => {
      const { data } = await apiClient.post<SavedQuery>(
        `/orgs/${orgSlug}/projects/${projectId}/saved-queries`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "saved-queries"],
      });
    },
  });
}

export function useUpdateSavedQuery(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      queryId,
      body,
    }: {
      queryId: string;
      body: SavedQueryUpdateRequest;
    }): Promise<SavedQuery> => {
      const { data } = await apiClient.put<SavedQuery>(
        `/orgs/${orgSlug}/projects/${projectId}/saved-queries/${queryId}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "saved-queries"],
      });
    },
  });
}

export function useDeleteSavedQuery(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (queryId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/saved-queries/${queryId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "saved-queries"],
      });
    },
  });
}

export function useRunSavedQuery(orgSlug: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "saved-queries", "run"],
    queryFn: async (): Promise<ArtifactsListResult> => {
      throw new Error("useRunSavedQuery: pass queryId via enabled + queryKey");
    },
    enabled: false,
  });
}

/** Run a saved query and return artifact list. Use via apiClient or a dedicated hook with queryId. */
export async function runSavedQuery(
  orgSlug: string,
  projectId: string,
  queryId: string,
  limit?: number,
  offset?: number,
): Promise<ArtifactsListResult> {
  const params: Record<string, number> = {};
  if (limit != null) params.limit = limit;
  if (offset != null) params.offset = offset;
  const { data } = await apiClient.get<ArtifactsListResult>(
    `/orgs/${orgSlug}/projects/${projectId}/saved-queries/${queryId}/run`,
    { params: Object.keys(params).length ? params : undefined },
  );
  return data;
}

/**
 * Build filter_params from current list state (for saving).
 */
export function listStateToFilterParams(state: {
  stateFilter?: string;
  typeFilter?: string;
  treeFilter?: string;
  searchQuery?: string;
  cycleNodeFilter?: string;
  areaNodeFilter?: string;
  sortBy?: string;
  sortOrder?: string;
}): Record<string, unknown> {
  const fp: Record<string, unknown> = {};
  if (state.stateFilter) fp.state = state.stateFilter;
  if (state.typeFilter) fp.type = state.typeFilter;
  if (state.treeFilter && (state.treeFilter === "requirement" || state.treeFilter === "quality" || state.treeFilter === "defect")) fp.tree = state.treeFilter;
  if (state.searchQuery?.trim()) fp.q = state.searchQuery.trim();
  if (state.cycleNodeFilter) fp.cycle_node_id = state.cycleNodeFilter;
  if (state.areaNodeFilter) fp.area_node_id = state.areaNodeFilter;
  if (state.sortBy) fp.sort_by = state.sortBy;
  if (state.sortOrder) fp.sort_order = state.sortOrder;
  return fp;
}

/**
 * Apply saved query filter_params to list state (for setListState).
 */
export function filterParamsToListStatePatch(
  filterParams: Record<string, unknown> | null | undefined,
): Partial<{
  stateFilter: string;
  typeFilter: string;
  treeFilter: "" | "requirement" | "quality" | "defect";
  searchQuery: string;
  searchInput: string;
  cycleNodeFilter: string;
  areaNodeFilter: string;
  sortBy: "artifact_key" | "title" | "state" | "artifact_type" | "created_at" | "updated_at";
  sortOrder: "asc" | "desc";
  page: number;
}> {
  if (!filterParams || typeof filterParams !== "object") {
    return { page: 0 };
  }
  const state = String(filterParams.state ?? "").trim();
  const type = String(filterParams.type ?? "").trim();
  const tree = String(filterParams.tree ?? "").trim();
  const treeFilter = (tree === "requirement" || tree === "quality" || tree === "defect" ? tree : "") as "" | "requirement" | "quality" | "defect";
  const q = String(filterParams.q ?? "").trim();
  const cycle = String(filterParams.cycle_node_id ?? "").trim();
  const area = String(filterParams.area_node_id ?? "").trim();
  const sortBy = String(filterParams.sort_by ?? "created_at").trim() as "artifact_key" | "title" | "state" | "artifact_type" | "created_at" | "updated_at";
  const sortOrder = (String(filterParams.sort_order ?? "desc").trim() === "asc"
    ? "asc"
    : "desc") as "asc" | "desc";
  return {
    stateFilter: state,
    typeFilter: type,
    treeFilter,
    searchQuery: q,
    searchInput: q,
    cycleNodeFilter: cycle,
    areaNodeFilter: area,
    sortBy: sortBy || "created_at",
    sortOrder,
    page: 0,
  };
}
