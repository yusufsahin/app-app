/**
 * Task API: artifact-linked work items (list, create, update, delete).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface Task {
  id: string;
  project_id: string;
  artifact_id: string;
  title: string;
  state: string;
  description: string;
  assignee_id: string | null;
  rank_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  state?: string;
  assignee_id?: string | null;
  rank_order?: number | null;
}

export interface UpdateTaskRequest {
  title?: string;
  state?: string;
  description?: string | null;
  assignee_id?: string | null;
  rank_order?: number | null;
}

export function useTasksByArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data } = await apiClient.get<Task[]>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useCreateTask(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskRequest): Promise<Task> => {
      const body: Record<string, unknown> = {
        title: payload.title,
        description: payload.description ?? "",
        state: payload.state ?? "todo",
      };
      if (payload.assignee_id !== undefined) body.assignee_id = payload.assignee_id;
      if (payload.rank_order !== undefined) body.rank_order = payload.rank_order;
      const { data } = await apiClient.post<Task>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "tasks"],
      });
    },
  });
}

export function useUpdateTask(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
  taskId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTaskRequest): Promise<Task> => {
      const body: Record<string, unknown> = {};
      if (payload.title !== undefined) body.title = payload.title;
      if (payload.state !== undefined) body.state = payload.state;
      if (payload.description !== undefined) body.description = payload.description;
      if (payload.assignee_id !== undefined) body.assignee_id = payload.assignee_id;
      if (payload.rank_order !== undefined) body.rank_order = payload.rank_order;
      const { data } = await apiClient.patch<Task>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks/${taskId}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "tasks"],
      });
    },
  });
}

export function useDeleteTask(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks/${taskId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "tasks"],
      });
    },
  });
}
