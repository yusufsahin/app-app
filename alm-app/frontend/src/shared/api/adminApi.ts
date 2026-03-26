/**
 * Admin API: users (list/create/delete), access audit. Requires admin role.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface AdminUser {
  user_id: string;
  email: string;
  display_name: string;
  deleted_at: string | null;
  role_slugs: string[];
}

export interface CreateAdminUserRequest {
  email: string;
  password: string;
  display_name?: string;
  role_slug?: string;
}

export interface CreateAdminUserResponse {
  user_id: string;
  email: string;
  display_name: string;
}

export interface AccessAuditEntry {
  id: string;
  timestamp: string | null;
  type: string;
  email: string | null;
  ip: string | null;
  user_agent: string | null;
}

export function useAdminUsers(includeDeleted: boolean) {
  return useQuery({
    queryKey: ["admin", "users", includeDeleted],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data } = await apiClient.get<AdminUser[]>(
        `/admin/users?include_deleted=${includeDeleted}`,
      );
      return data;
    },
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateAdminUserRequest) => {
      const { data } = await apiClient.post<CreateAdminUserResponse>(
        "/admin/users",
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
  });
}

export interface AccessAuditParams {
  from_date?: string;
  to_date?: string;
  type_filter?: string;
  limit?: number;
}

export function useAccessAudit(params: AccessAuditParams) {
  const search = new URLSearchParams();
  if (params.from_date) search.set("from_date", params.from_date);
  if (params.to_date) search.set("to_date", params.to_date);
  if (params.type_filter) search.set("type_filter", params.type_filter);
  if (params.limit != null) search.set("limit", String(params.limit));
  const queryString = search.toString();
  return useQuery({
    queryKey: ["admin", "audit", "access", params],
    queryFn: async (): Promise<AccessAuditEntry[]> => {
      const { data } = await apiClient.get<
        AccessAuditEntry[] | { items?: AccessAuditEntry[]; data?: AccessAuditEntry[] }
      >(
        `/admin/audit/access${queryString ? `?${queryString}` : ""}`,
      );
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    },
  });
}
