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
  surface?: string;
}

export function useListSchema(
  orgSlug: string | undefined,
  projectId: string | undefined,
  entityType = "artifact",
  surface?: string,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "list-schema", entityType, surface ?? null],
    queryFn: async (): Promise<ListSchemaDto | null> => {
      if (!orgSlug || !projectId) return null;
      const { data } = await apiClient.get<ListSchemaDto>(
        `/orgs/${orgSlug}/projects/${projectId}/list-schema`,
        { params: { entity_type: entityType, surface } },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
    staleTime: 60_000,
  });
}
