import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLastExecutionStatusBatch,
  type LastExecutionStatusItem,
} from "../../../shared/api/qualityLastExecutionApi";

function uniqueSortedIds(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

/**
 * Batch last saved run status per test case (project scope). Cache key is order-insensitive.
 */
export function useLastExecutionStatusBatch(
  orgSlug: string | undefined,
  projectId: string | undefined,
  testIds: string[],
) {
  const uniqueSorted = useMemo(() => uniqueSortedIds(testIds), [testIds]);
  const sortedKey = uniqueSorted.join(",");

  return useQuery({
    queryKey: ["qualityLastExec", orgSlug, projectId, sortedKey] as const,
    queryFn: () => fetchLastExecutionStatusBatch(orgSlug!, projectId!, uniqueSorted),
    enabled: Boolean(orgSlug && projectId && uniqueSorted.length > 0),
    staleTime: 60_000,
  });
}

export function lastExecutionStatusMap(items: LastExecutionStatusItem[] | undefined): Map<string, LastExecutionStatusItem> {
  const m = new Map<string, LastExecutionStatusItem>();
  if (!items) return m;
  for (const it of items) {
    m.set(it.test_id, it);
  }
  return m;
}
