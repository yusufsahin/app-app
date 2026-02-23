import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface DashboardStats {
  projects: number;
  artifacts: number;
  tasks: number;
  openDefects: number;
}

export function useDashboardStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "stats", tenantId],
    queryFn: async (): Promise<DashboardStats> => {
      const { data } = await apiClient.get<DashboardStats>(
        `/tenants/${tenantId}/dashboard/stats`,
      );
      return data;
    },
    enabled: !!tenantId,
  });
}
