/**
 * Task API: artifact-linked work items (list, create, update, delete).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface TaskTagBrief {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  project_id: string;
  artifact_id: string;
  title: string;
  state: string;
  description: string;
  assignee_id: string | null;
  rank_order: number | null;
  team_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  tags?: TaskTagBrief[];
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  state?: string;
  assignee_id?: string | null;
  team_id?: string | null;
  rank_order?: number | null;
  tag_ids?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  state?: string;
  description?: string | null;
  assignee_id?: string | null;
  team_id?: string | null;
  rank_order?: number | null;
  tag_ids?: string[];
}

export async function fetchTasksForArtifact(
  orgSlug: string,
  projectId: string,
  artifactId: string,
  teamId: string | null = null,
): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks`,
    { params: teamId ? { team_id: teamId } : undefined },
  );
  return data;
}

export function useTasksByArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
  teamId?: string | null,
) {
  const tid = teamId ?? null;
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "tasks", tid],
    queryFn: () =>
      fetchTasksForArtifact(orgSlug!, projectId!, artifactId!, tid === null ? null : tid),
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

/** List tasks in a project assigned to the current user ("my tasks"). */
export function useMyTasksInProject(
  orgSlug: string | undefined,
  projectId: string | undefined,
  teamId?: string | null,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "tasks", "assignee=me", teamId ?? null],
    queryFn: async (): Promise<Task[]> => {
      const { data } = await apiClient.get<Task[]>(
        `/orgs/${orgSlug}/projects/${projectId}/tasks`,
        { params: { assignee_id: "me", ...(teamId ? { team_id: teamId } : {}) } },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export type CreateTaskMutationInput = CreateTaskRequest & { artifactId: string };

export function useCreateTask(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskMutationInput): Promise<Task> => {
      const { artifactId, ...rest } = payload;
      const body: Record<string, unknown> = {
        title: rest.title,
        description: rest.description ?? "",
        state: rest.state ?? "todo",
      };
      if (rest.assignee_id !== undefined) body.assignee_id = rest.assignee_id;
      if (rest.team_id !== undefined) body.team_id = rest.team_id;
      if (rest.rank_order !== undefined) body.rank_order = rest.rank_order;
      if (rest.tag_ids !== undefined) body.tag_ids = rest.tag_ids;
      const { data } = await apiClient.post<Task>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks`,
        body,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", variables.artifactId, "tasks"],
      });
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "tasks"] });
    },
  });
}

export type UpdateTaskMutationInput = UpdateTaskRequest & { artifactId: string; taskId: string };

export function useUpdateTask(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTaskMutationInput): Promise<Task> => {
      const { artifactId, taskId, ...rest } = payload;
      const body: Record<string, unknown> = {};
      if (rest.title !== undefined) body.title = rest.title;
      if (rest.state !== undefined) body.state = rest.state;
      if (rest.description !== undefined) body.description = rest.description;
      if (rest.assignee_id !== undefined) body.assignee_id = rest.assignee_id;
      if (rest.team_id !== undefined) body.team_id = rest.team_id;
      if (rest.rank_order !== undefined) body.rank_order = rest.rank_order;
      if (rest.tag_ids !== undefined) body.tag_ids = rest.tag_ids;
      const { data } = await apiClient.patch<Task>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks/${taskId}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", variables.artifactId, "tasks"],
      });
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "tasks"] });
    },
  });
}

export type DeleteTaskMutationInput = { artifactId: string; taskId: string };

export type ReorderArtifactTasksInput = { artifactId: string; orderedTaskIds: string[] };

export async function reorderTasksForArtifact(
  orgSlug: string,
  projectId: string,
  artifactId: string,
  orderedTaskIds: string[],
): Promise<void> {
  await apiClient.post(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks/reorder`,
    { ordered_task_ids: orderedTaskIds },
  );
}

export function useReorderArtifactTasks(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ artifactId, orderedTaskIds }: ReorderArtifactTasksInput): Promise<void> => {
      await reorderTasksForArtifact(orgSlug!, projectId!, artifactId, orderedTaskIds);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", variables.artifactId, "tasks"],
      });
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "tasks"] });
    },
  });
}

export function useDeleteTask(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ artifactId, taskId }: DeleteTaskMutationInput): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/tasks/${taskId}`,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", variables.artifactId, "tasks"],
      });
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "tasks"] });
    },
  });
}
