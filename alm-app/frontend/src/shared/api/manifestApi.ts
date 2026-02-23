/**
 * Manifest API: process template manifest for a project
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ManifestResponse {
  manifest_bundle: {
    workflows?: unknown[];
    policies?: unknown[];
    [key: string]: unknown;
  };
  template_name: string;
  template_slug: string;
  version: string;
}

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
