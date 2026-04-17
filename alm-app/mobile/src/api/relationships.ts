import { api } from './client';

export interface ArtifactRelationship {
  id: string;
  project_id: string;
  source_artifact_id: string;
  target_artifact_id: string;
  other_artifact_id: string;
  other_artifact_type: string | null;
  other_artifact_key: string | null;
  other_artifact_title: string;
  relationship_type: string;
  direction: 'incoming' | 'outgoing';
  category: string;
  display_label: string;
  created_at: string | null;
}

export interface RelationshipTypeOption {
  key: string;
  label: string;
  reverse_label: string;
  category: string;
  directionality: string;
  allowed_target_types: string[];
  description?: string | null;
}

export async function fetchArtifactRelationships(
  orgSlug: string,
  projectId: string,
  artifactId: string,
): Promise<ArtifactRelationship[]> {
  const { data } = await api.get<ArtifactRelationship[]>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships`,
  );
  return data;
}

export async function fetchRelationshipTypeOptions(
  orgSlug: string,
  projectId: string,
  artifactId: string,
): Promise<RelationshipTypeOption[]> {
  const { data } = await api.get<RelationshipTypeOption[]>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships/options`,
  );
  return data;
}

export async function createArtifactRelationship(
  orgSlug: string,
  projectId: string,
  artifactId: string,
  body: { target_artifact_id: string; relationship_type: string },
): Promise<ArtifactRelationship> {
  const { data } = await api.post<ArtifactRelationship>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships`,
    body,
  );
  return data;
}

export async function deleteArtifactRelationship(
  orgSlug: string,
  projectId: string,
  artifactId: string,
  relationshipId: string,
): Promise<void> {
  await api.delete(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships/${relationshipId}`,
  );
}

export function relationshipsQueryKey(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return ['orgs', orgSlug, 'projects', projectId, 'artifacts', artifactId, 'relationships'] as const;
}
