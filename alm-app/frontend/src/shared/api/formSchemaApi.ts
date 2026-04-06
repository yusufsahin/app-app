/**
 * Form schema API — metadata-driven form definitions for artifact create, etc.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { FormSchemaDto } from "../types/formSchema";

export function useFormSchema(
  orgSlug: string | undefined,
  projectId: string | undefined,
  entityType = "artifact",
  context = "create",
  artifactType?: string,
  /** Avoid empty body while `artifactType` query key changes (narrowed create/edit). */
  keepPreviousDataWhileFetching = false,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "form-schema", entityType, context, artifactType],
    queryFn: async (): Promise<FormSchemaDto> => {
      const params: Record<string, string> = { entity_type: entityType, context };
      if (artifactType) params.artifact_type = artifactType;
      const { data } = await apiClient.get<FormSchemaDto>(
        `/orgs/${orgSlug}/projects/${projectId}/form-schema`,
        { params },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
    staleTime: 60_000,
    placeholderData: keepPreviousDataWhileFetching ? keepPreviousData : undefined,
  });
}
