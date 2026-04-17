/**
 * Manifest API: process template manifest for a project
 */
import type { ManifestResponse } from "@alm/manifest-types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export type { ManifestResponse };

export function useProjectManifest(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "manifest"],
    queryFn: async (): Promise<ManifestResponse> => {
      const { data } = await apiClient.get<ManifestResponse>(
        `/orgs/${orgSlug}/projects/${projectId}/manifest`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useUpdateProjectManifest(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (manifest_bundle: ManifestResponse["manifest_bundle"]) => {
      const { data } = await apiClient.put<ManifestResponse>(
        `/orgs/${orgSlug}/projects/${projectId}/manifest`,
        { manifest_bundle },
      );
      return data;
    },
    onSuccess: (data) => {
      if (orgSlug && projectId && data) {
        queryClient.setQueryData(
          ["orgs", orgSlug, "projects", projectId, "manifest"],
          data,
        );
      }
    },
  });
}
