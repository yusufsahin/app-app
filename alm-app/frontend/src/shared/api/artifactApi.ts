/**
 * Artifact API: work items (requirements, defects) and workflow transitions
 * Syncs with artifactStore for client-side state.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { useArtifactStore, type Artifact } from "../stores/artifactStore";

export type { Artifact };

export interface CreateArtifactRequest {
  artifact_type: string;
  title: string;
  description?: string;
  parent_id?: string | null;
  custom_fields?: Record<string, unknown>;
}

export function useArtifacts(
  orgSlug: string | undefined,
  projectId: string | undefined,
  stateFilter?: string,
) {
  const setArtifacts = useArtifactStore((s) => s.setArtifacts);
  const params = stateFilter ? { state: stateFilter } : undefined;

  const query = useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", stateFilter],
    queryFn: async (): Promise<Artifact[]> => {
      const { data } = await apiClient.get<Artifact[]>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts`,
        { params },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });

  useEffect(() => {
    if (query.data && projectId) {
      setArtifacts(projectId, query.data);
    }
  }, [query.data, projectId, setArtifacts]);

  return query;
}

export function useArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId],
    queryFn: async (): Promise<Artifact> => {
      const { data } = await apiClient.get<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useCreateArtifact(orgSlug: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  const addArtifact = useArtifactStore((s) => s.addArtifact);

  return useMutation({
    mutationFn: async (payload: CreateArtifactRequest): Promise<Artifact> => {
      const { data } = await apiClient.post<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts`,
        {
          artifact_type: payload.artifact_type,
          title: payload.title,
          description: payload.description ?? "",
          parent_id: payload.parent_id ?? undefined,
          custom_fields: payload.custom_fields,
        },
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
      if (projectId) addArtifact(projectId, data);
    },
  });
}

export function useTransitionArtifact(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();
  const updateArtifact = useArtifactStore((s) => s.updateArtifact);

  return useMutation({
    mutationFn: async (newState: string): Promise<Artifact> => {
      const { data } = await apiClient.patch<Artifact>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/transition`,
        { new_state: newState },
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId],
      });
      if (projectId && artifactId) updateArtifact(projectId, artifactId, data);
    },
  });
}
