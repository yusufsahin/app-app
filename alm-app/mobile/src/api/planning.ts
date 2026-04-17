import { api } from './client';

export type CadenceType = 'release' | 'cycle';

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

function normalizeCadence(node: Cadence): Cadence {
  const nodeType = node.type ?? 'cycle';
  const children = Array.isArray(node.children) ? node.children.map(normalizeCadence) : [];
  return { ...node, type: nodeType, children };
}

export async function fetchCadences(
  orgSlug: string,
  projectId: string,
  flat = false,
  type?: CadenceType,
): Promise<Cadence[]> {
  const params: { flat: boolean; type?: string } = { flat };
  if (type) params.type = type;
  const { data } = await api.get<Cadence[]>(`/orgs/${orgSlug}/projects/${projectId}/cadences`, {
    params,
  });
  return data.map(normalizeCadence);
}

export async function fetchAreaNodes(
  orgSlug: string,
  projectId: string,
  flat = false,
): Promise<AreaNode[]> {
  const { data } = await api.get<AreaNode[]>(`/orgs/${orgSlug}/projects/${projectId}/area-nodes`, {
    params: { flat },
  });
  return data;
}

export function cadencesQueryKey(
  orgSlug: string | undefined,
  projectId: string | undefined,
  flat: boolean,
  type?: CadenceType,
) {
  return ['orgs', orgSlug, 'projects', projectId, 'cadences', flat, type] as const;
}

export function areaNodesQueryKey(orgSlug: string | undefined, projectId: string | undefined, flat: boolean) {
  return ['orgs', orgSlug, 'projects', projectId, 'area-nodes', flat] as const;
}
