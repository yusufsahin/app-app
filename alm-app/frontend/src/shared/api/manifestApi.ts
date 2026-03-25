/**
 * Manifest API: process template manifest for a project
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ManifestResponse {
  manifest_bundle: {
    workflows?: Array<{ id: string; states?: string[]; resolution_target_states?: string[] }>;
    artifact_types?: Array<{
      id: string;
      name?: string;
      workflow_id?: string;
      fields?: unknown[];
      icon?: string;
      is_system_root?: boolean;
    }>;
    link_types?: Array<{
      id?: string;
      name?: string;
      label?: string;
      direction?: string;
      cardinality?: string;
      from_types?: string[];
      to_types?: string[];
      description?: string;
    }>;
    tree_roots?: Array<{ tree_id?: string; id?: string; root_artifact_type?: string; root_type?: string; label?: string }>;
    task_workflow_id?: string;
    /** PostgreSQL FTS regconfig override for artifact search (allowlisted server-side). */
    search_locale?: string;
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
