import { api } from './client';

export type LastExecutionStepStatusItem = {
  step_id: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-executed';
};

export type LastExecutionStatusItem = {
  test_id: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-executed' | null;
  run_id: string | null;
  run_title: string | null;
  run_updated_at: string | null;
  step_results: LastExecutionStepStatusItem[];
};

export async function fetchLastExecutionStatusBatch(
  orgSlug: string,
  projectId: string,
  testIds: string[],
): Promise<LastExecutionStatusItem[]> {
  if (testIds.length === 0) return [];
  const unique = [...new Set(testIds)].slice(0, 200);
  const { data } = await api.post<{ items: LastExecutionStatusItem[] }>(
    `/orgs/${orgSlug}/projects/${projectId}/quality/last-execution-status`,
    { test_ids: unique },
  );
  return (data.items ?? []).map((item) => ({
    ...item,
    step_results: item.step_results ?? [],
  }));
}
