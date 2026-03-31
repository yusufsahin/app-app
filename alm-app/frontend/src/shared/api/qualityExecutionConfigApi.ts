import { apiClient } from "./client";

export type ResolvedExecutionConfigOption = {
  id: string;
  name: string | null;
  is_default: boolean;
};

export type ResolvedExecutionConfigStep = {
  id: string;
  step_number: number;
  name: string;
  description: string;
  expected_result: string;
  status: "passed" | "failed" | "blocked" | "not-executed";
};

export type ResolvedExecutionConfigResponse = {
  test_id: string;
  configuration_id: string | null;
  configuration_name: string | null;
  available_configurations: ResolvedExecutionConfigOption[];
  resolved_values: Record<string, string>;
  unresolved_params: string[];
  warnings: string[];
  steps: ResolvedExecutionConfigStep[];
};

export async function resolveExecutionConfig(
  orgSlug: string,
  projectId: string,
  runId: string,
  testId: string,
  configurationId: string | null,
): Promise<ResolvedExecutionConfigResponse> {
  const { data } = await apiClient.post<ResolvedExecutionConfigResponse>(
    `/orgs/${orgSlug}/projects/${projectId}/quality/execution-config/resolve`,
    {
      run_id: runId,
      test_id: testId,
      configuration_id: configurationId,
    },
  );
  return {
    ...data,
    available_configurations: data.available_configurations ?? [],
    resolved_values: data.resolved_values ?? {},
    unresolved_params: data.unresolved_params ?? [],
    warnings: data.warnings ?? [],
    steps: data.steps ?? [],
  };
}
