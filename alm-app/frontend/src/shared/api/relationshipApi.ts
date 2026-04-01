import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ArtifactRelationship {
  id: string;
  project_id: string;
  source_artifact_id: string;
  target_artifact_id: string;
  other_artifact_id: string;
  other_artifact_type: string | null;
  other_artifact_key: string | null;
  other_artifact_title: string;
  relationship_type: string;
  direction: "incoming" | "outgoing";
  category: string;
  display_label: string;
  created_at: string | null;
  sort_order?: number | null;
}

export interface RelationshipTypeOption {
  key: string;
  label: string;
  reverse_label: string;
  category: string;
  directionality: string;
  allowed_target_types: string[];
  description?: string | null;
}

export interface ImpactHierarchyRef {
  id: string;
  artifact_key?: string | null;
  title: string;
  artifact_type: string;
}

export interface ArtifactImpactAnalysisNode {
  artifact_id: string;
  artifact_key?: string | null;
  artifact_type: string;
  title: string;
  state: string;
  parent_id?: string | null;
  relationship_id?: string | null;
  relationship_type?: string | null;
  relationship_label?: string | null;
  direction?: "incoming" | "outgoing" | null;
  depth: number;
  has_more: boolean;
  hierarchy_path: ImpactHierarchyRef[];
  children: ArtifactImpactAnalysisNode[];
}

export interface ArtifactImpactAnalysisResponse {
  focus_artifact: import("./artifactApi").Artifact;
  trace_from: ArtifactImpactAnalysisNode[];
  trace_to: ArtifactImpactAnalysisNode[];
  applied_relationship_types: string[];
  depth: number;
}

export interface CreateArtifactRelationshipRequest {
  target_artifact_id: string;
  relationship_type: string;
}

export interface BulkArtifactRelationshipRequest {
  target_artifact_ids: string[];
  relationship_type: string;
  idempotency_key?: string;
}

export interface BulkArtifactRelationshipDeleteRequest {
  relationship_ids: string[];
  idempotency_key?: string;
}

export interface BulkArtifactRelationshipResult {
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
}

export interface ReorderArtifactRelationshipsRequest {
  relationship_type: string;
  ordered_relationship_ids: string[];
}

const keyForRelationships = (
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) => ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "relationships"];

const keyForImpactAnalysis = (
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
  direction: "both" | "from" | "to",
  depth: number,
  relationshipTypes: string[],
  includeHierarchy: boolean,
) => [
  ...keyForRelationships(orgSlug, projectId, artifactId),
  "impact-analysis",
  direction,
  depth,
  relationshipTypes.join(","),
  includeHierarchy,
];

export function incomingRunForSuiteRelationships(
  relationships: ArtifactRelationship[] | undefined,
  suiteId: string,
): ArtifactRelationship[] {
  if (!relationships?.length) return [];
  return relationships.filter(
    (relationship) =>
      relationship.relationship_type === "run_for_suite" &&
      relationship.direction === "incoming" &&
      relationship.target_artifact_id === suiteId,
  );
}

export function sortOutgoingRelationships(
  relationships: ArtifactRelationship[],
  sourceArtifactId: string,
  relationshipType: string,
): ArtifactRelationship[] {
  const filtered = relationships.filter(
    (relationship) =>
      relationship.relationship_type === relationshipType &&
      relationship.direction === "outgoing" &&
      relationship.source_artifact_id === sourceArtifactId,
  );
  return [...filtered].sort((a, b) => {
    const ao = a.sort_order;
    const bo = b.sort_order;
    if (ao == null && bo == null) {
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    }
    if (ao == null) return 1;
    if (bo == null) return -1;
    if (ao !== bo) return ao - bo;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

export function useArtifactRelationships(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: keyForRelationships(orgSlug, projectId, artifactId),
    queryFn: async (): Promise<ArtifactRelationship[]> => {
      const { data } = await apiClient.get<ArtifactRelationship[]>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useRelationshipTypeOptions(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: [...keyForRelationships(orgSlug, projectId, artifactId), "options"],
    queryFn: async (): Promise<RelationshipTypeOption[]> => {
      const { data } = await apiClient.get<RelationshipTypeOption[]>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships/options`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useArtifactImpactAnalysis(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
  options?: {
    direction?: "both" | "from" | "to";
    depth?: number;
    relationshipTypes?: string[];
    includeHierarchy?: boolean;
  },
) {
  const direction = options?.direction ?? "both";
  const depth = options?.depth ?? 2;
  const relationshipTypes = options?.relationshipTypes ?? ["impacts", "blocks"];
  const includeHierarchy = options?.includeHierarchy ?? true;
  return useQuery({
    queryKey: keyForImpactAnalysis(
      orgSlug,
      projectId,
      artifactId,
      direction,
      depth,
      relationshipTypes,
      includeHierarchy,
    ),
    queryFn: async (): Promise<ArtifactImpactAnalysisResponse> => {
      const { data } = await apiClient.get<ArtifactImpactAnalysisResponse>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships/impact-analysis`,
        {
          params: {
            direction,
            depth,
            relationship_types: relationshipTypes.join(","),
            include_hierarchy: includeHierarchy,
          },
        },
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId && relationshipTypes.length > 0,
  });
}

export function useCreateArtifactRelationship(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateArtifactRelationshipRequest): Promise<ArtifactRelationship> => {
      const { data } = await apiClient.post<ArtifactRelationship>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyForRelationships(orgSlug, projectId, artifactId) });
      queryClient.invalidateQueries({ queryKey: [...keyForRelationships(orgSlug, projectId, artifactId), "options"] });
    },
  });
}

export function useDeleteArtifactRelationship(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (relationshipId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships/${relationshipId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyForRelationships(orgSlug, projectId, artifactId) });
      queryClient.invalidateQueries({ queryKey: [...keyForRelationships(orgSlug, projectId, artifactId), "options"] });
    },
  });
}

export function useBulkCreateArtifactRelationships(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: BulkArtifactRelationshipRequest,
    ): Promise<BulkArtifactRelationshipResult> => {
      const { data } = await apiClient.post<BulkArtifactRelationshipResult>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships/bulk`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyForRelationships(orgSlug, projectId, artifactId) });
      queryClient.invalidateQueries({ queryKey: [...keyForRelationships(orgSlug, projectId, artifactId), "options"] });
    },
  });
}

export function useBulkDeleteArtifactRelationships(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: BulkArtifactRelationshipDeleteRequest,
    ): Promise<BulkArtifactRelationshipResult> => {
      const { data } = await apiClient.post<BulkArtifactRelationshipResult>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships/bulk-delete`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyForRelationships(orgSlug, projectId, artifactId) });
      queryClient.invalidateQueries({ queryKey: [...keyForRelationships(orgSlug, projectId, artifactId), "options"] });
    },
  });
}

export function useReorderArtifactRelationships(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ReorderArtifactRelationshipsRequest): Promise<void> => {
      await apiClient.patch(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/relationships/reorder`,
        payload,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keyForRelationships(orgSlug, projectId, artifactId) });
      queryClient.invalidateQueries({ queryKey: [...keyForRelationships(orgSlug, projectId, artifactId), "options"] });
    },
  });
}
