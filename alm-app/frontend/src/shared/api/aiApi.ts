import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createParser, type EventSourceMessage } from "eventsource-parser";
import { apiClient } from "./client";
import type {
  AgentTurnResponse,
  AiConversation,
  AiPendingAction,
} from "../../features/aiAssistant/types/ai";

interface GeneratePayload {
  project_id: string;
  artifact_type: string;
  title: string;
  description_hint?: string;
  provider_config_id?: string;
}

interface GenerateResponse {
  description: string;
  acceptance_criteria: string[];
  test_cases: string[];
}

interface CreateConversationPayload {
  project_id?: string;
  first_message: string;
  autonomy_level: "suggest" | "confirm" | "auto";
  provider_config_id?: string;
  artifact_context_id?: string;
}

export interface AiProviderConfig {
  id: string;
  tenant_id: string;
  name: string;
  provider: string;
  model: string;
  base_url: string | null;
  is_default: boolean;
  is_enabled: boolean;
  has_api_key: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AiInsight {
  id: string;
  tenant_id: string;
  project_id: string;
  insight_type: string;
  severity: string;
  title: string;
  body: string;
  context: Record<string, unknown>;
  is_dismissed: boolean;
  created_at: string | null;
}

export function useAiGenerate(orgSlug: string) {
  return useMutation({
    mutationFn: async (payload: GeneratePayload) => {
      const { data } = await apiClient.post<GenerateResponse>(`/orgs/${orgSlug}/ai/generate`, payload);
      return data;
    },
  });
}

export function useCreateAiConversation(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateConversationPayload) => {
      const { data } = await apiClient.post<AgentTurnResponse>(
        `/orgs/${orgSlug}/ai/conversations`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "conversations", orgSlug] });
    },
  });
}

export function useSendAiMessage(orgSlug: string, conversationId: string | null) {
  return useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) throw new Error("conversationId is required");
      const { data } = await apiClient.post<AgentTurnResponse>(
        `/orgs/${orgSlug}/ai/conversations/${conversationId}/messages`,
        { content },
      );
      return data;
    },
  });
}

export async function sendAiMessageStream(
  orgSlug: string,
  conversationId: string,
  content: string,
): Promise<AgentTurnResponse> {
  const token = localStorage.getItem("alm_access_token");
  const response = await fetch(`/api/orgs/${orgSlug}/ai/conversations/${conversationId}/messages/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
  });
  if (!response.ok || !response.body) {
    throw new Error("Stream request failed");
  }

  return new Promise<AgentTurnResponse>((resolve, reject) => {
    let done = false;
    const parser = createParser({
      onEvent(event: EventSourceMessage) {
        if (event.event === "final") {
          done = true;
          resolve(JSON.parse(event.data) as AgentTurnResponse);
          return;
        }
        if (event.event === "error") {
          done = true;
          reject(new Error(JSON.parse(event.data).message ?? "Streaming failed"));
        }
      },
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const pump = async () => {
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
      if (!done) {
        reject(new Error("Stream ended unexpectedly"));
      }
    };
    void pump();
  });
}

export function useAiConversations(orgSlug: string, projectId?: string) {
  return useQuery({
    queryKey: ["ai", "conversations", orgSlug, projectId ?? "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<AiConversation[]>(`/orgs/${orgSlug}/ai/conversations`, {
        params: { project_id: projectId },
      });
      return data;
    },
  });
}

export function useAiPendingActions(orgSlug: string, conversationId: string | null) {
  return useQuery({
    queryKey: ["ai", "pending-actions", orgSlug, conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const { data } = await apiClient.get<AiPendingAction[]>(
        `/orgs/${orgSlug}/ai/conversations/${conversationId}/pending-actions`,
      );
      return data;
    },
  });
}

export function useResolvePendingAction(orgSlug: string, approve: boolean) {
  return useMutation({
    mutationFn: async (actionId: string) => {
      const suffix = approve ? "approve" : "reject";
      const { data } = await apiClient.post<AiPendingAction>(
        `/orgs/${orgSlug}/ai/pending-actions/${actionId}/${suffix}`,
      );
      return data;
    },
  });
}

export function useAiProviders(orgSlug: string) {
  return useQuery({
    queryKey: ["ai", "providers", orgSlug],
    queryFn: async () => {
      const { data } = await apiClient.get<AiProviderConfig[]>(`/orgs/${orgSlug}/ai/providers`);
      return data;
    },
  });
}

export function useUpsertAiProvider(orgSlug: string, providerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<AiProviderConfig, "id" | "tenant_id" | "has_api_key" | "created_at" | "updated_at"> & { api_key?: string | null }) => {
      if (providerId) {
        const { data } = await apiClient.put<AiProviderConfig>(
          `/orgs/${orgSlug}/ai/providers/${providerId}`,
          payload,
        );
        return data;
      }
      const { data } = await apiClient.post<AiProviderConfig>(`/orgs/${orgSlug}/ai/providers`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "providers", orgSlug] }),
  });
}

export function useDeleteAiProvider(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      await apiClient.delete(`/orgs/${orgSlug}/ai/providers/${providerId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "providers", orgSlug] }),
  });
}

export function useAiInsights(orgSlug: string, projectId: string | null) {
  return useQuery({
    queryKey: ["ai", "insights", orgSlug, projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get<AiInsight[]>(
        `/orgs/${orgSlug}/projects/${projectId}/ai/insights`,
      );
      return data;
    },
  });
}
