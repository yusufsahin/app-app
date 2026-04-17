import type { Project } from '../types/api';
import { api } from './client';

export async function fetchOrgProjects(orgSlug: string): Promise<Project[]> {
  const { data } = await api.get<Project[]>(`/orgs/${orgSlug}/projects`);
  return data;
}
