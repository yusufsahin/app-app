import type { FormSchemaDto } from '../types/formSchema';
import { api } from './client';

export async function fetchFormSchema(
  orgSlug: string,
  projectId: string,
  entityType = 'artifact',
  context = 'create',
  artifactType?: string,
): Promise<FormSchemaDto> {
  const params: Record<string, string> = { entity_type: entityType, context };
  if (artifactType) params.artifact_type = artifactType;
  const { data } = await api.get<FormSchemaDto>(`/orgs/${orgSlug}/projects/${projectId}/form-schema`, {
    params,
  });
  return data;
}

export function formSchemaQueryKey(
  orgSlug: string | undefined,
  projectId: string | undefined,
  entityType: string,
  context: string,
  artifactType?: string,
) {
  return ['orgs', orgSlug, 'projects', projectId, 'form-schema', entityType, context, artifactType] as const;
}
