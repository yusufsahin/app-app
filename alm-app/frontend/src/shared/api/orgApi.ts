/**
 * Azure DevOps-style org API: /orgs/{org_slug}/...
 * Project list is the single source of truth in React Query; no sync to projectStore.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import type {
  TenantMember,
  TenantRoleDetail,
  InviteMemberRequest,
} from "./tenantApi";
import type { Project, DashboardStats } from "./types";

export type { TenantMember, TenantRoleDetail, Project, DashboardStats };

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: string | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface DashboardActivityItem {
  artifact_id: string;
  project_id: string;
  project_slug: string;
  title: string;
  state: string;
  artifact_type: string;
  updated_at: string | null;
}

export interface CreateProjectRequest {
  code: string;
  name: string;
  description?: string;
  process_template_slug?: string;
}

export function useOrgProjects(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data } = await apiClient.get<Project[]>(
        `/orgs/${orgSlug}/projects`,
      );
      return data;
    },
    enabled: !!orgSlug,
  });
}

export function useCreateOrgProject(orgSlug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProjectRequest): Promise<Project> => {
      const { data } = await apiClient.post<Project>(
        `/orgs/${orgSlug}/projects`,
        {
          code: payload.code.trim().toUpperCase(),
          name: payload.name,
          description: payload.description ?? "",
          process_template_slug: payload.process_template_slug ?? "basic",
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects"] });
    },
  });
}

export function useUpdateOrgProject(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateProjectRequest): Promise<Project> => {
      const { data } = await apiClient.patch<Project>(
        `/orgs/${orgSlug}/projects/${projectId}`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects"] });
    },
  });
}

export function useOrgDashboardStats(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "dashboard", "stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const { data } = await apiClient.get<DashboardStats>(
        `/orgs/${orgSlug}/dashboard/stats`,
      );
      return data;
    },
    enabled: !!orgSlug,
  });
}

export function useOrgDashboardActivity(
  orgSlug: string | undefined,
  limit = 10,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "dashboard", "activity", limit],
    queryFn: async (): Promise<DashboardActivityItem[]> => {
      const { data } = await apiClient.get<DashboardActivityItem[]>(
        `/orgs/${orgSlug}/dashboard/activity`,
        { params: { limit } },
      );
      return data;
    },
    enabled: !!orgSlug,
  });
}

export function useOrgMembers(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "members"],
    queryFn: async (): Promise<TenantMember[]> => {
      const { data } = await apiClient.get<TenantMember[]>(
        `/orgs/${orgSlug}/members`,
      );
      return data;
    },
    enabled: !!orgSlug,
  });
}

export function useOrgRoles(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "roles"],
    queryFn: async (): Promise<TenantRoleDetail[]> => {
      const { data } = await apiClient.get<TenantRoleDetail[]>(
        `/orgs/${orgSlug}/roles`,
      );
      return data;
    },
    enabled: !!orgSlug,
  });
}

export function useInviteOrgMember(orgSlug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: InviteMemberRequest) => {
      const { data } = await apiClient.post(
        `/orgs/${orgSlug}/invite`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "members"] });
    },
  });
}

// ── Project members ──

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
}

export interface AddProjectMemberRequest {
  user_id: string;
  role?: string;
}

export function useProjectMembers(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "members"],
    queryFn: async (): Promise<ProjectMember[]> => {
      const { data } = await apiClient.get<ProjectMember[]>(
        `/orgs/${orgSlug}/projects/${projectId}/members`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useAddProjectMember(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddProjectMemberRequest): Promise<ProjectMember> => {
      const { data } = await apiClient.post<ProjectMember>(
        `/orgs/${orgSlug}/projects/${projectId}/members`,
        {
          user_id: payload.user_id,
          role: payload.role ?? "PROJECT_VIEWER",
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "members"],
      });
    },
  });
}

export function useRemoveProjectMember(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/members/${userId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "members"],
      });
    },
  });
}

export function useUpdateProjectMember(
  orgSlug: string | undefined,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: string;
    }): Promise<ProjectMember> => {
      const { data } = await apiClient.patch<ProjectMember>(
        `/orgs/${orgSlug}/projects/${projectId}/members/${userId}`,
        { role },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "members"],
      });
    },
  });
}
