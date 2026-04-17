import { api } from './client';

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

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', body);
  return data;
}

export async function switchTenant(tenantId: string, tempToken: string): Promise<AuthTokenResponse> {
  const { data } = await api.post<AuthTokenResponse>(
    '/auth/switch-tenant',
    { tenant_id: tenantId },
    { headers: { Authorization: `Bearer ${tempToken}` } },
  );
  return data;
}

export async function fetchCurrentUser(): Promise<CurrentUserResponse> {
  const { data } = await api.get<CurrentUserResponse>('/auth/me');
  return data;
}
