/**
 * Azure DevOps-style org API: /orgs/{org_slug}/...
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { useProjectStore } from "../stores/projectStore";
import type {
  TenantMember,
  TenantRoleDetail,
  InviteMemberRequest,
} from "./tenantApi";

export type { TenantMember, TenantRoleDetail };

export interface Project {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string;
}

export interface DashboardStats {
  projects: number;
  artifacts: number;
  tasks: number;
  openDefects: number;
}

export interface CreateProjectRequest {
  code: string;
  name: string;
  description?: string;
}

export function useOrgProjects(orgSlug: string | undefined) {
  const setProjects = useProjectStore((s) => s.setProjects);

  const query = useQuery({
    queryKey: ["orgs", orgSlug, "projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data } = await apiClient.get<Project[]>(
        `/orgs/${orgSlug}/projects`,
      );
      return data;
    },
    enabled: !!orgSlug,
  });

  useEffect(() => {
    if (query.data && orgSlug) {
      setProjects(orgSlug, query.data);
    }
  }, [query.data, orgSlug, setProjects]);

  return query;
}

export function useCreateOrgProject(orgSlug: string | undefined) {
  const queryClient = useQueryClient();
  const addProject = useProjectStore((s) => s.addProject);

  return useMutation({
    mutationFn: async (payload: CreateProjectRequest): Promise<Project> => {
      const { data } = await apiClient.post<Project>(
        `/orgs/${orgSlug}/projects`,
        {
          code: payload.code.trim().toUpperCase(),
          name: payload.name,
          description: payload.description ?? "",
        },
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects"] });
      if (orgSlug) addProject(orgSlug, data);
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
