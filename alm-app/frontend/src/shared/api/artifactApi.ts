/**
 * Artifact API: work items (requirements, defects) and workflow transitions.
 * Artifact list is the single source of truth in React Query; no sync to artifactStore.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { Artifact } from "../stores/artifactStore";

export type { Artifact };

export interface CreateArtifactRequest {
  artifact_type: string;
  title: string;
  description?: string;
  parent_id?: string | null;
  assignee_id?: string | null;
  custom_fields?: Record<string, unknown>;
}

export type ArtifactSortBy =
  | "artifact_key"
  | "title"
  | "state"
  | "artifact_type"
  | "created_at"
  | "updated_at";
export type ArtifactSortOrder = "asc" | "desc";

export interface ArtifactsListResult {
  items: Artifact[];
  total: number;
  /** Permission-aware UI: actions the current user can perform (e.g. create when list is empty). */
  allowed_actions?: string[];
}

export interface ArtifactListParams {
  state?: string;
  type?: string;
  sort_by?: ArtifactSortBy;
  sort_order?: ArtifactSortOrder;
  q?: string;
  limit?: number;
  offset?: number;
  include_deleted?: boolean;
  cycle_node_id?: string;
  area_node_id?: string;
}

/**
 * Build query params for artifact list API (pure, testable).
 */
export function buildArtifactListParams(options: {
  stateFilter?: string;
  typeFilter?: string;
  sortBy?: ArtifactSortBy;
  sortOrder?: ArtifactSortOrder;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
  cycleNodeId?: string | null;
  areaNodeId?: string | null;
}): ArtifactListParams {
  const params: ArtifactListParams = {};
  const {
    stateFilter,
    typeFilter,
    sortBy,
    sortOrder,
    searchQuery,
    limit,
    offset,
    includeDeleted,
    cycleNodeId,
    areaNodeId,
  } = options;
  if (stateFilter) params.state = stateFilter;
  if (typeFilter) params.type = typeFilter;
  if (sortBy) params.sort_by = sortBy;
  if (sortOrder) params.sort_order = sortOrder;
  const q = searchQuery?.trim();
  if (q) params.q = q;
  if (limit != null) params.limit = limit;
  if (offset != null) params.offset = offset;
  if (includeDeleted) params.include_deleted = true;
  if (cycleNodeId) params.cycle_node_id = cycleNodeId;
  if (areaNodeId) params.area_node_id = areaNodeId;
  return params;
}

export function useArtifacts(
  orgSlug: string | undefined,
  projectId: string | undefined,
  stateFilter?: string,
  typeFilter?: string,
  sortBy?: ArtifactSortBy,
  sortOrder?: ArtifactSortOrder,
  searchQuery?: string,
  limit?: number,
  offset?: number,
  includeDeleted?: boolean,
  cycleNodeId?: string | null,
  areaNodeId?: string | null,
) {
  const params = buildArtifactListParams({
    stateFilter,
    typeFilter,
    sortBy,
    sortOrder,
    searchQuery,
    limit,
    offset,
    includeDeleted,
    cycleNodeId,
    areaNodeId,
  });

  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", stateFilter, typeFilter, sortBy, sortOrder, searchQuery?.trim() || null, limit, offset, includeDeleted, cycleNodeId || null, areaNodeId || null],
    queryFn: async (): Promise<ArtifactsListResult> => {
      const { data } = await apiClient.get<ArtifactsListResult>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts`,
        { params: Object.keys(params).length ? params : undefined },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId],
    queryFn: async (): Promise<Artifact> => {
      const { data } = await apiClient.get<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useCreateArtifact(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateArtifactRequest): Promise<Artifact> => {
      const body: Record<string, unknown> = {
        artifact_type: payload.artifact_type,
        title: payload.title,
        description: payload.description ?? "",
        custom_fields: payload.custom_fields ?? {},
      };
      if (payload.parent_id != null && payload.parent_id !== "") body.parent_id = payload.parent_id;
      if (payload.assignee_id != null && payload.assignee_id !== "") body.assignee_id = payload.assignee_id;
      const { data } = await apiClient.post<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
    },
  });
}

export interface UpdateArtifactRequest {
  title?: string;
  description?: string | null;
  assignee_id?: string | null;
  cycle_node_id?: string | null;
  area_node_id?: string | null;
}

export interface PermittedTransitionItem {
  trigger: string;
  to_state: string;
  label?: string | null;
}

export interface PermittedTransitionsResponse {
  items: PermittedTransitionItem[];
}

export interface TransitionArtifactRequest {
  new_state?: string | null;
  trigger?: string | null;
  state_reason?: string | null;
  resolution?: string | null;
  /** ISO datetime for optimistic lock; omit to skip check (e.g. overwrite). */
  expected_updated_at?: string | null;
}

export interface BatchTransitionRequest {
  artifact_ids: string[];
  new_state?: string | null;
  trigger?: string | null;
  state_reason?: string | null;
  resolution?: string | null;
}

export interface BatchDeleteRequest {
  artifact_ids: string[];
}

export interface BatchResultResponse {
  success_count: number;
  error_count: number;
  errors: string[];
  /** Per-artifact result: artifact_id -> 'ok' | 'validation_error' | 'policy_denied' | 'conflict_error' */
  results?: Record<string, string>;
}

export function usePermittedTransitions(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "permitted-transitions"],
    queryFn: async (): Promise<PermittedTransitionsResponse> => {
      const { data } = await apiClient.get<PermittedTransitionsResponse>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/permitted-transitions`,
      );
      return data;
    },
    enabled: !!(orgSlug && projectId && artifactId),
  });
}

export function useUpdateArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateArtifactRequest): Promise<Artifact> => {
      const body: Record<string, unknown> = {};
      if (payload.title !== undefined) body.title = payload.title;
      if (payload.description !== undefined) body.description = payload.description;
      if (payload.assignee_id !== undefined) body.assignee_id = payload.assignee_id ?? null;
      if (payload.cycle_node_id !== undefined) body.cycle_node_id = payload.cycle_node_id ?? null;
      if (payload.area_node_id !== undefined) body.area_node_id = payload.area_node_id ?? null;
      const { data } = await apiClient.patch<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}`,
        body,
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", data.id],
      });
    },
  });
}

export function useDeleteArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (artifactId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
    },
  });
}

export function useTransitionArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TransitionArtifactRequest): Promise<Artifact> => {
      const body: Record<string, string> = {};
      if (payload.trigger != null && payload.trigger !== "") body.trigger = payload.trigger;
      else if (payload.new_state != null && payload.new_state !== "") body.new_state = payload.new_state;
      if (payload.state_reason != null && payload.state_reason !== "")
        body.state_reason = payload.state_reason;
      if (payload.resolution != null && payload.resolution !== "")
        body.resolution = payload.resolution;
      if (payload.expected_updated_at != null && payload.expected_updated_at !== "")
        body.expected_updated_at = payload.expected_updated_at;
      const { data } = await apiClient.patch<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/transition`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId],
      });
    },
  });
}

/** Transition any artifact by id (e.g. for board drag-and-drop). */
export function useTransitionArtifactById(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { artifactId: string } & TransitionArtifactRequest): Promise<Artifact> => {
      const body: Record<string, string> = {};
      if (payload.trigger != null && payload.trigger !== "") body.trigger = payload.trigger;
      else if (payload.new_state != null && payload.new_state !== "") body.new_state = payload.new_state;
      if (payload.state_reason != null && payload.state_reason !== "")
        body.state_reason = payload.state_reason;
      if (payload.resolution != null && payload.resolution !== "")
        body.resolution = payload.resolution;
      if (payload.expected_updated_at != null && payload.expected_updated_at !== "")
        body.expected_updated_at = payload.expected_updated_at;
      const { data } = await apiClient.patch<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${payload.artifactId}/transition`,
        body,
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", data.id],
      });
    },
  });
}

export function useBatchTransitionArtifacts(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: BatchTransitionRequest,
    ): Promise<BatchResultResponse> => {
      const body: Record<string, unknown> = { artifact_ids: payload.artifact_ids };
      if (payload.trigger != null && payload.trigger !== "") body.trigger = payload.trigger;
      else if (payload.new_state != null && payload.new_state !== "") body.new_state = payload.new_state;
      if (payload.state_reason != null && payload.state_reason !== "")
        body.state_reason = payload.state_reason;
      if (payload.resolution != null && payload.resolution !== "")
        body.resolution = payload.resolution;
      const { data } = await apiClient.post<BatchResultResponse>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/batch-transition`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
    },
  });
}

export function useBatchDeleteArtifacts(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: BatchDeleteRequest,
    ): Promise<BatchResultResponse> => {
      const { data } = await apiClient.post<BatchResultResponse>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/batch-delete`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
    },
  });
}

export function useRestoreArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (artifactId: string): Promise<Artifact> => {
      const { data } = await apiClient.post<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/restore`,
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", data?.id],
      });
    },
  });
}
