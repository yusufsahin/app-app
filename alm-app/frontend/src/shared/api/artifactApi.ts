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
  team_id?: string | null;
  custom_fields?: Record<string, unknown>;
  tag_ids?: string[];
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

export type ArtifactIoScope = "generic" | "testcases" | "runs";
export type ArtifactIoFormat = "csv" | "xlsx";
export type ArtifactImportMode = "create" | "update" | "upsert";

export interface ArtifactImportRowResult {
  row_number: number;
  sheet: string;
  artifact_key?: string | null;
  status: "created" | "updated" | "validated" | "skipped" | "failed";
  message?: string | null;
  artifact_id?: string | null;
}

export interface ArtifactImportResult {
  created_count: number;
  updated_count: number;
  validated_count: number;
  skipped_count: number;
  failed_count: number;
  rows: ArtifactImportRowResult[];
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
  cycle_id?: string;
  release_id?: string;
  area_node_id?: string;
  tree?: string;
  /** When true, API returns system root rows (Requirements / Quality / Defects folder roots). */
  include_system_roots?: boolean;
  /** Direct children of this parent artifact (combined with `tree` subtree when set). */
  parent_id?: string;
  /** Filter by project tag id. */
  tag_id?: string;
  /** Filter by assigned team id. */
  team_id?: string;
  /** Filter by assigned user id. */
  assignee_id?: string;
  /** When true, only artifacts with no assignee. */
  unassigned_only?: boolean;
  /** S4b: only artifacts with stale_traceability=true. */
  stale_traceability_only?: boolean;
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
  cycleId?: string | null;
  releaseId?: string | null;
  areaNodeId?: string | null;
  tree?: string | null;
  includeSystemRoots?: boolean;
  parentId?: string | null;
  tagId?: string | null;
  teamId?: string | null;
  assigneeId?: string | null;
  unassignedOnly?: boolean;
  staleTraceabilityOnly?: boolean;
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
    cycleId,
    releaseId,
    areaNodeId,
    tree,
    includeSystemRoots,
    parentId,
    tagId,
    teamId,
    assigneeId,
    unassignedOnly,
    staleTraceabilityOnly,
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
  if (releaseId) params.release_id = releaseId;
  else if (cycleId) params.cycle_id = cycleId;
  if (areaNodeId) params.area_node_id = areaNodeId;
  const treeTrim = tree?.trim();
  if (treeTrim) params.tree = treeTrim;
  if (includeSystemRoots) params.include_system_roots = true;
  const parentTrim = parentId?.trim();
  if (parentTrim) params.parent_id = parentTrim;
  const tagTrim = tagId?.trim();
  if (tagTrim) params.tag_id = tagTrim;
  const teamTrim = teamId?.trim();
  if (teamTrim) params.team_id = teamTrim;
  if (unassignedOnly) params.unassigned_only = true;
  else {
    const aid = assigneeId?.trim();
    if (aid) params.assignee_id = aid;
  }
  if (staleTraceabilityOnly) params.stale_traceability_only = true;
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
  cycleId?: string | null,
  releaseId?: string | null,
  areaNodeId?: string | null,
  tree?: string | null,
  includeSystemRoots?: boolean,
  parentId?: string | null,
  tagId?: string | null,
  teamId?: string | null,
  assigneeId?: string | null,
  unassignedOnly?: boolean,
  /** When false, the query does not run (e.g. wait for a prerequisite like defect root). */
  queryEnabled: boolean = true,
  staleTraceabilityOnly: boolean = false,
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
    cycleId,
    releaseId,
    areaNodeId,
    tree,
    includeSystemRoots,
    parentId,
    tagId,
    teamId,
    assigneeId,
    unassignedOnly,
    staleTraceabilityOnly,
  });

  return useQuery({
    queryKey: [
      "orgs",
      orgSlug,
      "projects",
      projectId,
      "artifacts",
      stateFilter,
      typeFilter,
      sortBy,
      sortOrder,
      searchQuery?.trim() || null,
      limit,
      offset,
      includeDeleted,
      cycleId || null,
      releaseId || null,
      areaNodeId || null,
      tree || null,
      includeSystemRoots ?? false,
      parentId?.trim() || null,
      tagId?.trim() || null,
      teamId?.trim() || null,
      assigneeId?.trim() || null,
      unassignedOnly ?? false,
      queryEnabled,
      staleTraceabilityOnly,
    ],
    queryFn: async (): Promise<ArtifactsListResult> => {
      const { data } = await apiClient.get<ArtifactsListResult>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts`,
        { params: Object.keys(params).length ? params : undefined },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && queryEnabled,
  });
}

const ARTIFACT_LIST_PAGE_SIZE = 500;

/** Fetches every page for the given list filters until all items are loaded (for large catalogs). */
export async function fetchAllArtifactsPages(
  orgSlug: string,
  projectId: string,
  baseParams: Omit<ArtifactListParams, "limit" | "offset">,
  pageSize = ARTIFACT_LIST_PAGE_SIZE,
): Promise<ArtifactsListResult> {
  let offset = 0;
  const items: Artifact[] = [];
  let total = 0;
  let allowed_actions: string[] | undefined;
  for (;;) {
    const params: ArtifactListParams = { ...baseParams, limit: pageSize, offset };
    const { data } = await apiClient.get<ArtifactsListResult>(
      `/orgs/${orgSlug}/projects/${projectId}/artifacts`,
      { params: Object.keys(params).length ? params : undefined },
    );
    items.push(...data.items);
    total = data.total;
    allowed_actions ??= data.allowed_actions;
    if (data.items.length === 0 || data.items.length < pageSize || items.length >= total) break;
    offset += pageSize;
  }
  return { items, total, allowed_actions };
}

function downloadBlob(blob: Blob, fallbackFileName: string, contentDisposition?: string | null): void {
  const match = contentDisposition?.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] ?? fallbackFileName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportArtifactsFile(
  orgSlug: string,
  projectId: string,
  options: ArtifactListParams & {
    format: ArtifactIoFormat;
    scope: ArtifactIoScope;
  },
): Promise<void> {
  const response = await apiClient.get<Blob>(`/orgs/${orgSlug}/projects/${projectId}/artifacts/export`, {
    params: options,
    responseType: "blob",
  });
  downloadBlob(
    response.data,
    `artifacts-export.${options.format === "xlsx" ? "xlsx" : "csv"}`,
    response.headers["content-disposition"],
  );
}

export async function downloadArtifactImportTemplate(
  orgSlug: string,
  projectId: string,
  options: {
    format: ArtifactIoFormat;
    scope: Exclude<ArtifactIoScope, "runs">;
  },
): Promise<void> {
  const response = await apiClient.get<Blob>(`/orgs/${orgSlug}/projects/${projectId}/artifacts/import-template`, {
    params: options,
    responseType: "blob",
  });
  const fallback = options.scope === "testcases" && options.format === "csv" ? "artifact-import-template.zip" : `artifact-import-template.${options.format}`;
  downloadBlob(response.data, fallback, response.headers["content-disposition"]);
}

export async function importArtifactsFile(
  orgSlug: string,
  projectId: string,
  options: {
    file: File;
    scope: Exclude<ArtifactIoScope, "runs">;
    mode: ArtifactImportMode;
    validateOnly?: boolean;
  },
): Promise<ArtifactImportResult> {
  const formData = new FormData();
  formData.append("file", options.file);
  const { data } = await apiClient.post<ArtifactImportResult>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/import`,
    formData,
    {
      params: {
        scope: options.scope,
        mode: options.mode,
        validate_only: options.validateOnly ?? false,
      },
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
}

/** All test cases in the quality tree (paginated on the client until `total` is reached). */
export function useAllQualityTestCases(orgSlug: string | undefined, projectId: string | undefined) {
  const baseParams = buildArtifactListParams({
    typeFilter: "test-case",
    sortBy: "title",
    sortOrder: "asc",
    tree: "quality",
    includeSystemRoots: false,
  });
  return useQuery({
    queryKey: [
      "orgs",
      orgSlug,
      "projects",
      projectId,
      "artifacts",
      "all-pages",
      "quality",
      "test-case",
    ],
    queryFn: () => fetchAllArtifactsPages(orgSlug!, projectId!, baseParams),
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
      if (payload.team_id != null && payload.team_id !== "") body.team_id = payload.team_id;
      if (payload.tag_ids != null && payload.tag_ids.length > 0) body.tag_ids = payload.tag_ids;
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
  team_id?: string | null;
  cycle_id?: string | null;
  area_node_id?: string | null;
  parent_id?: string | null;
  custom_fields?: Record<string, unknown>;
  tag_ids?: string[];
  clear_stale_traceability?: boolean;
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
      if (payload.team_id !== undefined) body.team_id = payload.team_id ?? null;
      if (payload.cycle_id !== undefined) body.cycle_id = payload.cycle_id ?? null;
      if (payload.area_node_id !== undefined) body.area_node_id = payload.area_node_id ?? null;
      if (payload.parent_id !== undefined) body.parent_id = payload.parent_id ?? null;
      if (payload.custom_fields !== undefined) body.custom_fields = payload.custom_fields;
      if (payload.tag_ids !== undefined) body.tag_ids = payload.tag_ids;
      if (payload.clear_stale_traceability !== undefined) {
        body.clear_stale_traceability = payload.clear_stale_traceability;
      }
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

export function useUpdateArtifactById(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { artifactId: string; patch: UpdateArtifactRequest }): Promise<Artifact> => {
      const body: Record<string, unknown> = {};
      const patch = payload.patch;
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.description !== undefined) body.description = patch.description;
      if (patch.assignee_id !== undefined) body.assignee_id = patch.assignee_id ?? null;
      if (patch.team_id !== undefined) body.team_id = patch.team_id ?? null;
      if (patch.cycle_id !== undefined) body.cycle_id = patch.cycle_id ?? null;
      if (patch.area_node_id !== undefined) body.area_node_id = patch.area_node_id ?? null;
      if (patch.parent_id !== undefined) body.parent_id = patch.parent_id ?? null;
      if (patch.custom_fields !== undefined) body.custom_fields = patch.custom_fields;
      if (patch.tag_ids !== undefined) body.tag_ids = patch.tag_ids;
      if (patch.clear_stale_traceability !== undefined) {
        body.clear_stale_traceability = patch.clear_stale_traceability;
      }
      const { data } = await apiClient.patch<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${payload.artifactId}`,
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
