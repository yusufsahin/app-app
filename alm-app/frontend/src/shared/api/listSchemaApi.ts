/**
 * List schema API — metadata-driven list columns and filters from backend.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { ListSchemaDto } from "../types/listSchema";

export interface GetListSchemaParams {
  orgSlug: string;
  projectId: string;
  entityType?: string;
}

export function useListSchema(
  orgSlug: string | undefined,
  projectId: string | undefined,
  entityType = "artifact",
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "list-schema", entityType],
    queryFn: async (): Promise<ListSchemaDto | null> => {
      if (!orgSlug || !projectId) return null;
      const { data } = await apiClient.get<ListSchemaDto>(
        `/orgs/${orgSlug}/projects/${projectId}/list-schema`,
        { params: { entityType } },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
    staleTime: 60_000,
  });
}
