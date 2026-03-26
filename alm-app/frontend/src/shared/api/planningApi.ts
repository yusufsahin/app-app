/**
 * Planning API: cycle nodes (iterations) and area nodes (area path) for a project.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// ── Cycle nodes (iterations) ──

export type IncrementType = "release" | "iteration";

export interface Increment {
  id: string;
  project_id: string;
  name: string;
  path: string;
  parent_id: string | null;
  depth: number;
  sort_order: number;
  goal: string;
  start_date: string | null;
  end_date: string | null;
  state: string;
  type: IncrementType;
  created_at: string | null;
  updated_at: string | null;
  children: Increment[];
}

export interface IncrementCreateRequest {
  name: string;
  parent_id?: string | null;
  sort_order?: number;
  goal?: string;
  start_date?: string | null;
  end_date?: string | null;
  state?: string;
  type?: IncrementType;
}

export interface IncrementUpdateRequest {
  name?: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  state?: string | null;
  sort_order?: number | null;
  type?: IncrementType | null;
}

/** Display label for cycle in dropdowns (name + optional path). */
export function incrementDisplayLabel(node: { name: string; path?: string }): string {
  return node.path ? `${node.name} (${node.path})` : node.name;
}

/** Display label with type badge for dropdowns: "Sprint 1 (Iteration)" or "2024-R1 (Release)". */
function resolveCycleNodeType(node: { type?: IncrementType }): IncrementType {
  return node.type ?? "iteration";
}

export function incrementDisplayLabelWithType(node: { name: string; path?: string; type?: IncrementType }): string {
  const base = incrementDisplayLabel(node);
  const k = resolveCycleNodeType(node) === "release" ? "Release" : "Iteration";
  return `${base} · ${k}`;
}

/** Get release name for a cycle (parent release node name). cycleTree = flat list with parent_id/path/type. */
export function getReleaseNameForCycle(
  cycleNodeId: string | null | undefined,
  cycleTree: Array<{ id: string; parent_id: string | null; path?: string; type?: IncrementType }>,
): string | null {
  if (!cycleNodeId) return null;
  const node = cycleTree.find((c) => c.id === cycleNodeId);
  if (!node) return null;
  if (resolveCycleNodeType(node) === "release") return node.path ?? null;
  if (!node.parent_id) return null;
  const parent = cycleTree.find((c) => c.id === node.parent_id);
  if (!parent) return null;
  if (resolveCycleNodeType(parent) === "release") return parent.path ?? parent.id;
  return getReleaseNameForCycle(parent.id, cycleTree);
}

function normalizeIncrement(node: Increment): Increment {
  const nodeType = resolveCycleNodeType(node);
  const children = Array.isArray(node.children) ? node.children.map(normalizeIncrement) : [];
  return { ...node, type: nodeType, children };
}

function normalizeIncrementRequest(body: IncrementCreateRequest | IncrementUpdateRequest): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  const nodeType = body.type ?? undefined;
  if (nodeType) {
    out.type = nodeType;
  }
  return out;
}

/** Display label for area in dropdowns (name + optional path). */
export function areaNodeDisplayLabel(node: { name: string; path?: string }): string {
  return node.path ? `${node.name} (${node.path})` : node.name;
}

export function useIncrements(
  orgSlug: string | undefined,
  projectId: string | undefined,
  flat = false,
  type?: IncrementType,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "increments", flat, type],
    queryFn: async (): Promise<Increment[]> => {
      const params: { flat: boolean; type?: string } = { flat };
      if (type) {
        params.type = type;
      }
      const { data } = await apiClient.get<Increment[]>(
        `/orgs/${orgSlug}/projects/${projectId}/increments`,
        { params },
      );
      return data.map(normalizeIncrement);
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useCreateIncrement(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: IncrementCreateRequest): Promise<Increment> => {
      const { data } = await apiClient.post<Increment>(
        `/orgs/${orgSlug}/projects/${projectId}/increments`,
        normalizeIncrementRequest(body),
      );
      return normalizeIncrement(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "increments"],
      });
    },
  });
}

export function useUpdateIncrement(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      incrementId,
      body,
    }: {
      incrementId: string;
      body: IncrementUpdateRequest;
    }): Promise<Increment> => {
      const { data } = await apiClient.patch<Increment>(
        `/orgs/${orgSlug}/projects/${projectId}/increments/${incrementId}`,
        normalizeIncrementRequest(body),
      );
      return normalizeIncrement(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "increments"],
      });
    },
  });
}

export function useDeleteIncrement(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (incrementId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/increments/${incrementId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "increments"],
      });
    },
  });
}

// ── Area nodes ──

export interface AreaNode {
  id: string;
  project_id: string;
  name: string;
  path: string;
  parent_id: string | null;
  depth: number;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  children: AreaNode[];
}

export interface AreaNodeCreateRequest {
  name: string;
  parent_id?: string | null;
  sort_order?: number;
}

export interface AreaNodeUpdateRequest {
  name?: string | null;
  sort_order?: number | null;
}

export function useAreaNodes(
  orgSlug: string | undefined,
  projectId: string | undefined,
  flat = false,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "area-nodes", flat],
    queryFn: async (): Promise<AreaNode[]> => {
      const { data } = await apiClient.get<AreaNode[]>(
        `/orgs/${orgSlug}/projects/${projectId}/area-nodes`,
        { params: { flat } },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useCreateAreaNode(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AreaNodeCreateRequest): Promise<AreaNode> => {
      const { data } = await apiClient.post<AreaNode>(
        `/orgs/${orgSlug}/projects/${projectId}/area-nodes`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "area-nodes"],
      });
    },
  });
}

export function useUpdateAreaNode(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      areaNodeId,
      body,
    }: {
      areaNodeId: string;
      body: AreaNodeUpdateRequest;
    }): Promise<AreaNode> => {
      const { data } = await apiClient.patch<AreaNode>(
        `/orgs/${orgSlug}/projects/${projectId}/area-nodes/${areaNodeId}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "area-nodes"],
      });
    },
  });
}

export function useDeleteAreaNode(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (areaNodeId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/area-nodes/${areaNodeId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "area-nodes"],
      });
    },
  });
}
