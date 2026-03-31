import { apiClient } from "./client";

export type LastExecutionStepStatusItem = {
  step_id: string;
  status: "passed" | "failed" | "blocked" | "not-executed";
};

export type LastExecutionStatusItem = {
  test_id: string;
  status: "passed" | "failed" | "blocked" | "not-executed" | null;
  run_id: string | null;
  run_title: string | null;
  run_updated_at: string | null;
  configuration_id: string | null;
  configuration_name: string | null;
  param_row_index: number | null;
  step_results: LastExecutionStepStatusItem[];
};

export type LastExecutionStatusResponse = {
  items: LastExecutionStatusItem[];
};

const MAX_BATCH = 200;

export async function fetchLastExecutionStatusBatch(
  orgSlug: string,
  projectId: string,
  testIds: string[],
  scopeConfigurationId?: string | null,
): Promise<LastExecutionStatusItem[]> {
  if (testIds.length === 0) return [];
  const unique = [...new Set(testIds)].slice(0, MAX_BATCH);
  const { data } = await apiClient.post<LastExecutionStatusResponse>(
    `/orgs/${orgSlug}/projects/${projectId}/quality/last-execution-status`,
    {
      test_ids: unique,
      ...(scopeConfigurationId ? { scope_configuration_id: scopeConfigurationId } : {}),
    },
  );
  return (data.items ?? []).map((item) => ({
    ...item,
    step_results: item.step_results ?? [],
  }));
}
