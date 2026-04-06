/**
 * SCM webhook unmatched queue: deliveries that did not map to an artifact.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export type ScmUnmatchedTriage = "open" | "dismissed" | "all";

export interface ScmWebhookUnmatchedEvent {
  id: string;
  project_id: string;
  provider: string;
  kind: string;
  context: Record<string, unknown>;
  created_at: string;
  dismissed_at: string | null;
  dismissed_by: string | null;
}

export function scmWebhookUnmatchedEventsRootKey(orgSlug: string, projectId: string) {
  return ["orgs", orgSlug, "projects", projectId, "webhooks", "unmatched-events"] as const;
}

export function scmWebhookUnmatchedQueryKey(
  orgSlug: string,
  projectId: string,
  limit: number,
  triage: ScmUnmatchedTriage,
) {
  return [...scmWebhookUnmatchedEventsRootKey(orgSlug, projectId), limit, triage] as const;
}

export function useScmWebhookUnmatchedEvents(
  orgSlug: string | undefined,
  projectId: string | undefined,
  limit = 30,
  triage: ScmUnmatchedTriage = "open",
) {
  return useQuery({
    queryKey:
      orgSlug && projectId
        ? scmWebhookUnmatchedQueryKey(orgSlug, projectId, limit, triage)
        : ["orgs", "webhooks", "unmatched-events", "disabled"],
    queryFn: async () => {
      const { data } = await apiClient.get<ScmWebhookUnmatchedEvent[]>(
        `/orgs/${orgSlug}/projects/${projectId}/webhooks/unmatched-events`,
        { params: { limit, triage } },
      );
      return data;
    },
    enabled: Boolean(orgSlug && projectId),
  });
}

export async function dismissScmWebhookUnmatchedEvent(
  orgSlug: string,
  projectId: string,
  eventId: string,
): Promise<ScmWebhookUnmatchedEvent> {
  const { data } = await apiClient.post<ScmWebhookUnmatchedEvent>(
    `/orgs/${orgSlug}/projects/${projectId}/webhooks/unmatched-events/${eventId}/dismiss`,
  );
  return data;
}

export async function undismissScmWebhookUnmatchedEvent(
  orgSlug: string,
  projectId: string,
  eventId: string,
): Promise<ScmWebhookUnmatchedEvent> {
  const { data } = await apiClient.post<ScmWebhookUnmatchedEvent>(
    `/orgs/${orgSlug}/projects/${projectId}/webhooks/unmatched-events/${eventId}/undismiss`,
  );
  return data;
}
