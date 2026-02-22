import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { useAuthStore } from "../stores/authStore";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  token_type: string;
  requires_tenant_selection: boolean;
  tenants?: { id: string; name: string; slug: string; tier: string }[];
  temp_token?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
  org_name: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UpdateProfileRequest {
  display_name: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      apiClient.post<LoginResponse>("/auth/login", data).then((r) => r.data),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterRequest) =>
      apiClient.post<AuthTokenResponse>("/auth/register", data).then((r) => r.data),
  });
}

export function useSwitchTenant() {
  return useMutation({
    mutationFn: ({ tenantId, token }: { tenantId: string; token: string }) =>
      apiClient
        .post<AuthTokenResponse>(
          "/auth/switch-tenant",
          { tenant_id: tenantId },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .then((r) => r.data),
  });
}

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () =>
      apiClient.get<CurrentUserResponse>("/auth/me").then((r) => r.data),
    enabled: isAuthenticated,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      apiClient
        .post<{ message: string }>("/auth/change-password", data)
        .then((r) => r.data),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) =>
      apiClient
        .put<CurrentUserResponse>("/auth/me", data)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}
