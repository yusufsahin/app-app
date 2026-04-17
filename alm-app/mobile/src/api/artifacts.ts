import type { Artifact, ArtifactsListResult } from '../types/api';
import { api } from './client';

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
}

export interface ArtifactListParams {
  state?: string;
  type?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  q?: string;
  limit?: number;
  offset?: number;
  cycle_id?: string;
  release_id?: string;
  area_node_id?: string;
  tree?: string;
  include_system_roots?: boolean;
  parent_id?: string;
}

export interface PermittedTransitionItem {
  trigger: string;
  to_state: string;
  label?: string | null;
}

export interface TransitionArtifactRequest {
  new_state?: string | null;
  trigger?: string | null;
  state_reason?: string | null;
  resolution?: string | null;
  expected_updated_at?: string | null;
}

export async function fetchArtifacts(
  orgSlug: string,
  projectId: string,
  params?: ArtifactListParams,
): Promise<ArtifactsListResult> {
  const { data } = await api.get<ArtifactsListResult>(`/orgs/${orgSlug}/projects/${projectId}/artifacts`, {
    params: params && Object.keys(params).length ? params : undefined,
  });
  return data;
}

export async function fetchArtifact(
  orgSlug: string,
  projectId: string,
  artifactId: string,
): Promise<Artifact> {
  const { data } = await api.get<Artifact>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}`,
  );
  return data;
}

export async function createArtifact(
  orgSlug: string,
  projectId: string,
  payload: CreateArtifactRequest,
): Promise<Artifact> {
  const body: Record<string, unknown> = {
    artifact_type: payload.artifact_type,
    title: payload.title,
    description: payload.description ?? '',
    custom_fields: payload.custom_fields ?? {},
  };
  if (payload.parent_id != null && payload.parent_id !== '') body.parent_id = payload.parent_id;
  if (payload.assignee_id != null && payload.assignee_id !== '')
    body.assignee_id = payload.assignee_id;
  if (payload.team_id != null && payload.team_id !== '') body.team_id = payload.team_id;
  if (payload.tag_ids?.length) body.tag_ids = payload.tag_ids;
  const { data } = await api.post<Artifact>(`/orgs/${orgSlug}/projects/${projectId}/artifacts`, body);
  return data;
}

export async function updateArtifact(
  orgSlug: string,
  projectId: string,
  artifactId: string,
  patch: UpdateArtifactRequest,
): Promise<Artifact> {
  const { data } = await api.patch<Artifact>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}`,
    patch,
  );
  return data;
}

export async function fetchPermittedTransitions(
  orgSlug: string,
  projectId: string,
  artifactId: string,
): Promise<{ items: PermittedTransitionItem[] }> {
  const { data } = await api.get<{ items: PermittedTransitionItem[] }>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/permitted-transitions`,
  );
  return data;
}

export async function transitionArtifact(
  orgSlug: string,
  projectId: string,
  artifactId: string,
  payload: TransitionArtifactRequest,
): Promise<Artifact> {
  const body: Record<string, string> = {};
  if (payload.trigger != null && payload.trigger !== '') body.trigger = payload.trigger;
  else if (payload.new_state != null && payload.new_state !== '') body.new_state = payload.new_state;
  if (payload.state_reason) body.state_reason = payload.state_reason;
  if (payload.resolution) body.resolution = payload.resolution;
  if (payload.expected_updated_at) body.expected_updated_at = payload.expected_updated_at;
  const { data } = await api.patch<Artifact>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/transition`,
    body,
  );
  return data;
}

export function artifactsListQueryKey(
  orgSlug: string | undefined,
  projectId: string | undefined,
  params: ArtifactListParams,
) {
  return ['orgs', orgSlug, 'projects', projectId, 'artifacts', params] as const;
}
