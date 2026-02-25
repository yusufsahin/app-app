/**
 * Comment API: artifact-linked comments (list, create).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface Comment {
  id: string;
  project_id: string;
  artifact_id: string;
  body: string;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateCommentRequest {
  body: string;
}

export function useCommentsByArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "comments"],
    queryFn: async (): Promise<Comment[]> => {
      const { data } = await apiClient.get<Comment[]>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/comments`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useCreateComment(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCommentRequest): Promise<Comment> => {
      const { data } = await apiClient.post<Comment>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/comments`,
        { body: payload.body },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "comments"],
      });
    },
  });
}
