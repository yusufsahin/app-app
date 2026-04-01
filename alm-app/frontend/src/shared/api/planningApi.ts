/**
 * Planning API: cadences (release/cycle) and area nodes for a project.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

// ── Cadences (releases/cycles) ──

export type CadenceType = "release" | "cycle";

export interface Cadence {
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
  type: CadenceType;
  created_at: string | null;
  updated_at: string | null;
  children: Cadence[];
}

export interface CadenceCreateRequest {
  name: string;
  parent_id?: string | null;
  sort_order?: number;
  goal?: string;
  start_date?: string | null;
  end_date?: string | null;
  state?: string;
  type?: CadenceType;
}

export interface CadenceUpdateRequest {
  name?: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  state?: string | null;
  sort_order?: number | null;
  type?: CadenceType | null;
}

/** Display label for a cadence in dropdowns (name + optional path). */
export function cadenceDisplayLabel(node: { name: string; path?: string }): string {
  return node.path ? `${node.name} (${node.path})` : node.name;
}

/** Display label with type badge for dropdowns: "Cycle 1 · Cycle" or "2026-R1 · Release". */
function resolveCadenceType(node: { type?: CadenceType }): CadenceType {
  return node.type ?? "cycle";
}

export function cadenceDisplayLabelWithType(node: { name: string; path?: string; type?: CadenceType }): string {
  const base = cadenceDisplayLabel(node);
  const k = resolveCadenceType(node) === "release" ? "Release" : "Cycle";
  return `${base} · ${k}`;
}

/** Get release name for a cycle cadence (parent release cadence name). */
export function getReleaseNameForCycle(
  cycleCadenceId: string | null | undefined,
  cadenceTree: Array<{ id: string; parent_id: string | null; path?: string; type?: CadenceType }>,
): string | null {
  if (!cycleCadenceId) return null;
  const node = cadenceTree.find((c) => c.id === cycleCadenceId);
  if (!node) return null;
  if (resolveCadenceType(node) === "release") return node.path ?? null;
  if (!node.parent_id) return null;
  const parent = cadenceTree.find((c) => c.id === node.parent_id);
  if (!parent) return null;
  if (resolveCadenceType(parent) === "release") return parent.path ?? parent.id;
  return getReleaseNameForCycle(parent.id, cadenceTree);
}

function normalizeCadence(node: Cadence): Cadence {
  const nodeType = resolveCadenceType(node);
  const children = Array.isArray(node.children) ? node.children.map(normalizeCadence) : [];
  return { ...node, type: nodeType, children };
}

function normalizeCadenceRequest(body: CadenceCreateRequest | CadenceUpdateRequest): Record<string, unknown> {
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

export function useCadences(
  orgSlug: string | undefined,
  projectId: string | undefined,
  flat = false,
  type?: CadenceType,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "cadences", flat, type],
    queryFn: async (): Promise<Cadence[]> => {
      const params: { flat: boolean; type?: string } = { flat };
      if (type) {
        params.type = type;
      }
      const { data } = await apiClient.get<Cadence[]>(
        `/orgs/${orgSlug}/projects/${projectId}/cadences`,
        { params },
      );
      return data.map(normalizeCadence);
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useCreateCadence(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CadenceCreateRequest): Promise<Cadence> => {
      const { data } = await apiClient.post<Cadence>(
        `/orgs/${orgSlug}/projects/${projectId}/cadences`,
        normalizeCadenceRequest(body),
      );
      return normalizeCadence(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "cadences"],
      });
    },
  });
}

export function useUpdateCadence(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cadenceId,
      body,
    }: {
      cadenceId: string;
      body: CadenceUpdateRequest;
    }): Promise<Cadence> => {
      const { data } = await apiClient.patch<Cadence>(
        `/orgs/${orgSlug}/projects/${projectId}/cadences/${cadenceId}`,
        normalizeCadenceRequest(body),
      );
      return normalizeCadence(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "cadences"],
      });
    },
  });
}

export function useDeleteCadence(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cadenceId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/cadences/${cadenceId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "cadences"],
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
