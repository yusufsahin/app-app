import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../../shared/api/client";
import type { Artifact } from "../../../shared/stores/artifactStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

export type StartSuiteRunParams = {
  suiteId: string;
  suiteParentId: string;
  title: string;
  description: string;
  /** Manifest `environment` field on `test-run` when set. */
  environment?: string;
};

/**
 * Creates a test-run under the suite’s collection, links run → suite (`run_for_suite`), then navigates to execute.
 */
export function useStartSuiteRun(
  orgSlug: string | undefined,
  projectId: string | undefined,
  projectSlug: string | undefined,
) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const showNotification = useNotificationStore((s) => s.showNotification);
  const { t } = useTranslation("quality");

  return useMutation({
    mutationFn: async (params: StartSuiteRunParams): Promise<Artifact> => {
      if (!orgSlug || !projectId) throw new Error("Missing project");
      const env = params.environment?.trim();
      const custom_fields: Record<string, unknown> = {};
      if (env) custom_fields.environment = env;
      const body: Record<string, unknown> = {
        artifact_type: "test-run",
        title: params.title,
        description: params.description ?? "",
        custom_fields,
        parent_id: params.suiteParentId,
      };
      const { data: run } = await apiClient.post<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts`,
        body,
      );
      await apiClient.post(`/orgs/${orgSlug}/projects/${projectId}/artifacts/${run.id}/links`, {
        to_artifact_id: params.suiteId,
        link_type: "run_for_suite",
      });
      return run;
    },
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"] });
      if (orgSlug && projectSlug) {
        navigate(`/${orgSlug}/${projectSlug}/quality/runs/${run.id}/execute`);
      }
    },
    onError: () => {
      showNotification(t("campaignExecution.startRunError"), "error");
    },
  });
}
