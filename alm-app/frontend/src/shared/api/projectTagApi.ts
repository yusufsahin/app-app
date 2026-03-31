/**
 * Project work-item tags (ADO-style vocabulary).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ProjectTag {
  id: string;
  project_id: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export function useProjectTags(orgSlug: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "tags"],
    queryFn: async (): Promise<ProjectTag[]> => {
      const { data } = await apiClient.get<ProjectTag[]>(
        `/orgs/${orgSlug}/projects/${projectId}/tags`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useCreateProjectTag(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<ProjectTag> => {
      const { data } = await apiClient.post<ProjectTag>(
        `/orgs/${orgSlug}/projects/${projectId}/tags`,
        { name: name.trim() },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "tags"] });
    },
  });
}

export function useRenameProjectTag(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tagId: string; name: string }): Promise<ProjectTag> => {
      const { data } = await apiClient.patch<ProjectTag>(
        `/orgs/${orgSlug}/projects/${projectId}/tags/${input.tagId}`,
        { name: input.name.trim() },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "tags"] });
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"] });
    },
  });
}

export function useDeleteProjectTag(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string): Promise<void> => {
      await apiClient.delete(`/orgs/${orgSlug}/projects/${projectId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "tags"] });
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"] });
    },
  });
}
