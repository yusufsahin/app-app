import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface AuditPropertyChange {
  property_name: string;
  left: unknown;
  right: unknown;
}

export interface AuditSnapshot {
  id: string;
  commit_id: string;
  global_id: string;
  entity_type: string;
  entity_id: string;
  change_type: string;
  state: Record<string, unknown>;
  changed_properties: string[];
  version: number;
  committed_at: string | null;
  author_id: string | null;
}

export interface AuditChangeEntry {
  snapshot: AuditSnapshot;
  changes: AuditPropertyChange[];
}

export interface EntityHistoryResponse {
  entity_type: string;
  entity_id: string;
  total_versions: number;
  entries: AuditChangeEntry[];
}

export function useEntityHistory(
  entityType: string | undefined,
  entityId: string | undefined,
  limit = 30,
  offset = 0,
) {
  return useQuery({
    queryKey: ["audit", entityType, entityId, "history", limit, offset],
    queryFn: async (): Promise<EntityHistoryResponse> => {
      const { data } = await apiClient.get<EntityHistoryResponse>(
        `/audit/${entityType}/${entityId}/history`,
        { params: { limit, offset } },
      );
      return data;
    },
    enabled: !!entityType && !!entityId,
  });
}
