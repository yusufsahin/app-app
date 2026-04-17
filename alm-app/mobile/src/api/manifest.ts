import type { ManifestResponse } from '@alm/manifest-types';
import { api } from './client';

export async function fetchProjectManifest(
  orgSlug: string,
  projectId: string,
): Promise<ManifestResponse> {
  const { data } = await api.get<ManifestResponse>(`/orgs/${orgSlug}/projects/${projectId}/manifest`);
  return data;
}

export async function updateProjectManifest(
  orgSlug: string,
  projectId: string,
  manifest_bundle: ManifestResponse['manifest_bundle'],
): Promise<ManifestResponse> {
  const { data } = await api.put<ManifestResponse>(`/orgs/${orgSlug}/projects/${projectId}/manifest`, {
    manifest_bundle,
  });
  return data;
}

export function manifestQueryKey(
  orgSlug: string | null | undefined,
  projectId: string | null | undefined,
) {
  return ['orgs', orgSlug, 'projects', projectId, 'manifest'] as const;
}
