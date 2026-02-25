/**
 * Artifact link API: traceability links between artifacts (list, create, delete).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ArtifactLink {
  id: string;
  project_id: string;
  from_artifact_id: string;
  to_artifact_id: string;
  link_type: string;
  created_at: string | null;
}

export interface CreateArtifactLinkRequest {
  to_artifact_id: string;
  link_type?: string;
}

export function useArtifactLinks(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "links"],
    queryFn: async (): Promise<ArtifactLink[]> => {
      const { data } = await apiClient.get<ArtifactLink[]>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/links`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useCreateArtifactLink(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateArtifactLinkRequest): Promise<ArtifactLink> => {
      const { data } = await apiClient.post<ArtifactLink>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/links`,
        {
          to_artifact_id: payload.to_artifact_id,
          link_type: payload.link_type ?? "related",
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "links"],
      });
    },
  });
}

export function useDeleteArtifactLink(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/links/${linkId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "links"],
      });
    },
  });
}
