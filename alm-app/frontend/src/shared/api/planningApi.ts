/**
 * Planning API: cycle nodes (iterations) and area nodes (area path) for a project.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// ── Cycle nodes (iterations) ──

export type CycleNodeKind = "release" | "iteration";

export interface CycleNode {
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
  kind: CycleNodeKind;
  created_at: string | null;
  updated_at: string | null;
  children: CycleNode[];
}

export interface CycleNodeCreateRequest {
  name: string;
  parent_id?: string | null;
  sort_order?: number;
  goal?: string;
  start_date?: string | null;
  end_date?: string | null;
  state?: string;
  kind?: CycleNodeKind;
}

export interface CycleNodeUpdateRequest {
  name?: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  state?: string | null;
  sort_order?: number | null;
  kind?: CycleNodeKind | null;
}

/** Display label for cycle in dropdowns (name + optional path). */
export function cycleNodeDisplayLabel(node: { name: string; path?: string }): string {
  return node.path ? `${node.name} (${node.path})` : node.name;
}

/** Display label with kind badge for dropdowns: "Sprint 1 (Iteration)" or "2024-R1 (Release)". */
export function cycleNodeDisplayLabelWithKind(node: { name: string; path?: string; kind?: CycleNodeKind }): string {
  const base = cycleNodeDisplayLabel(node);
  const k = node.kind === "release" ? "Release" : "Iteration";
  return `${base} · ${k}`;
}

/** Get release name for a cycle (parent release node name). cycleTree = flat list with parent_id/path/kind. */
export function getReleaseNameForCycle(
  cycleNodeId: string | null | undefined,
  cycleTree: Array<{ id: string; parent_id: string | null; path?: string; kind?: CycleNodeKind }>,
): string | null {
  if (!cycleNodeId) return null;
  const node = cycleTree.find((c) => c.id === cycleNodeId);
  if (!node) return null;
  if (node.kind === "release") return node.path ?? null;
  if (!node.parent_id) return null;
  const parent = cycleTree.find((c) => c.id === node.parent_id);
  if (!parent) return null;
  if (parent.kind === "release") return parent.path ?? parent.id;
  return getReleaseNameForCycle(parent.id, cycleTree);
}

/** Display label for area in dropdowns (name + optional path). */
export function areaNodeDisplayLabel(node: { name: string; path?: string }): string {
  return node.path ? `${node.name} (${node.path})` : node.name;
}

export function useCycleNodes(
  orgSlug: string | undefined,
  projectId: string | undefined,
  flat = false,
  kind?: CycleNodeKind,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "cycle-nodes", flat, kind],
    queryFn: async (): Promise<CycleNode[]> => {
      const params: { flat: boolean; kind?: string } = { flat };
      if (kind) params.kind = kind;
      const { data } = await apiClient.get<CycleNode[]>(
        `/orgs/${orgSlug}/projects/${projectId}/cycle-nodes`,
        { params },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useCreateCycleNode(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CycleNodeCreateRequest): Promise<CycleNode> => {
      const { data } = await apiClient.post<CycleNode>(
        `/orgs/${orgSlug}/projects/${projectId}/cycle-nodes`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "cycle-nodes"],
      });
    },
  });
}

export function useUpdateCycleNode(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cycleNodeId,
      body,
    }: {
      cycleNodeId: string;
      body: CycleNodeUpdateRequest;
    }): Promise<CycleNode> => {
      const { data } = await apiClient.patch<CycleNode>(
        `/orgs/${orgSlug}/projects/${projectId}/cycle-nodes/${cycleNodeId}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "cycle-nodes"],
      });
    },
  });
}

export function useDeleteCycleNode(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cycleNodeId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/cycle-nodes/${cycleNodeId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "cycle-nodes"],
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
