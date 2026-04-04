/**
 * Process template API — list available templates (Basic, Scrum, Kanban).
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ProcessTemplate {
  id: string;
  slug: string;
  name: string;
  is_builtin: boolean;
  description?: string | null;
}

export function useProcessTemplates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["process-templates"],
    queryFn: async (): Promise<ProcessTemplate[]> => {
      const { data } = await apiClient.get<ProcessTemplate[]>(
        "/process-templates/",
      );
      return data;
    },
    staleTime: 5 * 60_000,
    enabled: options?.enabled !== false,
  });
}
