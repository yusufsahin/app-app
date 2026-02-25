/**
 * Form schema API — metadata-driven form definitions for artifact create, etc.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { FormSchemaDto } from "../types/formSchema";

export function useFormSchema(
  orgSlug: string | undefined,
  projectId: string | undefined,
  entityType = "artifact",
  context = "create",
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "form-schema", entityType, context],
    queryFn: async (): Promise<FormSchemaDto> => {
      const { data } = await apiClient.get<FormSchemaDto>(
        `/orgs/${orgSlug}/projects/${projectId}/form-schema`,
        {
          params: { entityType, context },
        },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
    staleTime: 60_000,
  });
}
