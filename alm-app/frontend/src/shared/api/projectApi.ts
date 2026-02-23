import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface Project {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string;
}

export function useProjects(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["projects", tenantId],
    queryFn: async (): Promise<Project[]> => {
      const { data } = await apiClient.get<Project[]>(
        `/tenants/${tenantId}/projects`,
      );
      return data;
    },
    enabled: !!tenantId,
  });
}

export interface CreateProjectRequest {
  code: string;
  name: string;
  description?: string;
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      data,
    }: {
      tenantId: string;
      data: CreateProjectRequest;
    }): Promise<Project> => {
      const { data: project } = await apiClient.post<Project>(
        `/tenants/${tenantId}/projects`,
        {
          code: data.code.trim().toUpperCase(),
          name: data.name,
          description: data.description ?? "",
        },
      );
      return project;
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ["projects", tenantId] });
    },
  });
}
