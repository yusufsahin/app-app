import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { useAuthStore } from "../stores/authStore";
import { useTenantStore } from "../stores/tenantStore";

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  tier: string;
  roles: string[];
}

export interface TenantMember {
  user_id: string;
  email: string;
  display_name: string;
  roles: {
    id: string;
    name: string;
    slug: string;
    is_system: boolean;
    hierarchy_level: number;
  }[];
  joined_at: string;
}

export interface TenantRoleDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_system: boolean;
  hierarchy_level: number;
  privileges: string[];
}

export interface Privilege {
  id: string;
  code: string;
  resource: string;
  action: string;
  description: string;
}

export interface InviteMemberRequest {
  email: string;
  role_ids: string[];
}

export interface InviteResponse {
  id: string;
  email: string;
  roles: string[];
  expires_at: string;
}

export interface CreateTenantRequest {
  name: string;
}

export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  tier: string;
}

export function useCreateTenant(tokenOverride?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTenantRequest) => {
      const headers = tokenOverride
        ? { Authorization: `Bearer ${tokenOverride}` }
        : undefined;
      return apiClient
        .post<TenantResponse>("/tenants/", data, { headers })
        .then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useMyTenants() {
  const hasAccessToken = useAuthStore((s) => !!s.accessToken);
  return useQuery({
    queryKey: ["tenants"],
    queryFn: () =>
      apiClient.get<TenantListItem[]>("/tenants/").then((r) => r.data),
    enabled: hasAccessToken,
  });
}

export function useTenantMembers(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenants", tenantId, "members"],
    queryFn: () =>
      apiClient
        .get<TenantMember[]>(`/tenants/${tenantId}/members`)
        .then((r) => r.data),
    enabled: !!tenantId,
  });
}

export function useTenantRoles(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenants", tenantId, "roles"],
    queryFn: () =>
      apiClient
        .get<TenantRoleDetail[]>(`/tenants/${tenantId}/roles`)
        .then((r) => r.data),
    enabled: !!tenantId,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  const tenantId = useTenantStore((s) => s.currentTenant?.id);
  return useMutation({
    mutationFn: (data: InviteMemberRequest) =>
      apiClient
        .post<InviteResponse>(`/tenants/${tenantId}/invite`, data)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "members"],
      });
    },
  });
}

export function usePrivileges() {
  const hasAccessToken = useAuthStore((s) => !!s.accessToken);
  return useQuery({
    queryKey: ["privileges"],
    queryFn: () =>
      apiClient.get<Privilege[]>("/tenants/privileges").then((r) => r.data),
    enabled: hasAccessToken,
  });
}
