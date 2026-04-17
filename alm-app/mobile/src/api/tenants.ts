import type { TenantListItem, TenantMember } from '../types/api';
import { api } from './client';

export async function fetchMyTenants(): Promise<TenantListItem[]> {
  const { data } = await api.get<TenantListItem[]>('/tenants/');
  return data;
}

export async function fetchTenantMembers(tenantId: string): Promise<TenantMember[]> {
  const { data } = await api.get<TenantMember[]>(`/tenants/${tenantId}/members`);
  return data;
}
