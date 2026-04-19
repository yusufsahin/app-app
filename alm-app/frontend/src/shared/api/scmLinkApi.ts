/**
 * SCM link API: PR/commit URLs tied to artifacts (optional task).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ScmLink {
  id: string;
  project_id: string;
  artifact_id: string;
  task_id: string | null;
  provider: string;
  repo_full_name: string;
  ref: string | null;
  commit_sha: string | null;
  pull_request_number: number | null;
  title: string | null;
  web_url: string;
  source: string;
  /** Webhook-only: which text slot produced the winning artifact key (branch, title, body). */
  key_match_source?: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ScmLinkParsePreviewRequest {
  web_url: string;
  context_text?: string | null;
}

export interface ScmLinkParsePreviewKeyMatch {
  hint: string;
  artifact_id: string;
  artifact_key: string;
  title: string;
  is_current_artifact: boolean;
}

export interface ScmLinkParsePreview {
  canonical_web_url: string;
  recognized: boolean;
  provider: string | null;
  repo_full_name: string | null;
  pull_request_number: number | null;
  commit_sha: string | null;
  suggested_title: string | null;
  artifact_key_hints: string[];
  artifact_key_matches: ScmLinkParsePreviewKeyMatch[];
  artifact_key_unmatched: string[];
  duplicate_link_id: string | null;
  duplicate_kind: "none" | "url" | "pull_request" | "commit";
}

export interface CreateScmLinkRequest {
  web_url: string;
  task_id?: string | null;
  provider?: string | null;
  repo_full_name?: string | null;
  ref?: string | null;
  commit_sha?: string | null;
  pull_request_number?: number | null;
  title?: string | null;
}

function scmLinksQueryKey(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
  taskId?: string | null,
) {
  return ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "scm-links", taskId ?? "all"] as const;
}

export function useScmLinksByArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
  taskId?: string | null,
) {
  return useQuery({
    queryKey: scmLinksQueryKey(orgSlug, projectId, artifactId, taskId),
    queryFn: async (): Promise<ScmLink[]> => {
      const params = taskId ? { task_id: taskId } : {};
      const { data } = await apiClient.get<ScmLink[]>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/scm-links`,
        { params },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useParseScmUrlPreview(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useMutation({
    mutationFn: async (payload: ScmLinkParsePreviewRequest): Promise<ScmLinkParsePreview> => {
      const ctx = payload.context_text?.trim();
      const { data } = await apiClient.post<ScmLinkParsePreview>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/scm-links/parse-preview`,
        {
          web_url: payload.web_url,
          ...(ctx ? { context_text: ctx } : {}),
        },
      );
      return data;
    },
  });
}

export function useCreateScmLink(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateScmLinkRequest): Promise<ScmLink> => {
      const { data } = await apiClient.post<ScmLink>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/scm-links`,
        {
          web_url: payload.web_url,
          task_id: payload.task_id ?? null,
          provider: payload.provider ?? null,
          repo_full_name: payload.repo_full_name ?? null,
          ref: payload.ref ?? null,
          commit_sha: payload.commit_sha ?? null,
          pull_request_number: payload.pull_request_number ?? null,
          title: payload.title ?? null,
        },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "scm-links"],
      });
    },
  });
}

export function useDeleteScmLink(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/scm-links/${linkId}`,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "scm-links"],
      });
    },
  });
}
