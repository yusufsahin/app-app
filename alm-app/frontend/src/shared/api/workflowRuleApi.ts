/**
 * Workflow rules API: list, create, update, delete (project-scoped automation rules).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface WorkflowRule {
  id: string;
  project_id: string;
  name: string;
  trigger_event_type: string;
  condition_expression: string | null;
  actions: Record<string, unknown>[];
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkflowRuleCreateRequest {
  name: string;
  trigger_event_type: string;
  actions: Record<string, unknown>[];
  condition_expression?: string | null;
  is_active?: boolean;
}

export interface WorkflowRuleUpdateRequest {
  name?: string;
  trigger_event_type?: string;
  actions?: Record<string, unknown>[];
  condition_expression?: string | null;
  is_active?: boolean;
}

export const TRIGGER_EVENT_TYPES = [
  { value: "artifact_created", label: "Artifact created" },
  { value: "artifact_state_changed", label: "Artifact state changed" },
] as const;

export function useWorkflowRules(orgSlug: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "workflow-rules"],
    queryFn: async (): Promise<WorkflowRule[]> => {
      const { data } = await apiClient.get<WorkflowRule[]>(
        `/orgs/${orgSlug}/projects/${projectId}/workflow-rules`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useCreateWorkflowRule(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WorkflowRuleCreateRequest): Promise<WorkflowRule> => {
      const { data } = await apiClient.post<WorkflowRule>(
        `/orgs/${orgSlug}/projects/${projectId}/workflow-rules`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "workflow-rules"],
      });
    },
  });
}

export function useUpdateWorkflowRule(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ruleId,
      body,
    }: {
      ruleId: string;
      body: WorkflowRuleUpdateRequest;
    }): Promise<WorkflowRule> => {
      const { data } = await apiClient.put<WorkflowRule>(
        `/orgs/${orgSlug}/projects/${projectId}/workflow-rules/${ruleId}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "workflow-rules"],
      });
    },
  });
}

export function useDeleteWorkflowRule(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/workflow-rules/${ruleId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "workflow-rules"],
      });
    },
  });
}
