/**
 * Stored report definitions & template catalog (/orgs/{slug}/...).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ReportTemplateCatalogItem {
  catalog_key: string;
  name: string;
  description: string;
  query_kind: string;
  chart_spec: Record<string, unknown>;
}

export interface ReportDefinition {
  id: string;
  tenant_id: string;
  project_id: string | null;
  created_by_id: string | null;
  forked_from_id: string | null;
  catalog_key: string | null;
  name: string;
  description: string;
  visibility: string;
  query_kind: string;
  builtin_report_id: string | null;
  builtin_parameters: Record<string, unknown>;
  sql_text: string | null;
  sql_bind_overrides: Record<string, unknown>;
  chart_spec: Record<string, unknown>;
  lifecycle_status: string;
  last_validated_at: string | null;
  last_validation_ok: boolean;
  last_validation_message: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ReportExecuteResult {
  query_kind: string;
  chart_spec: Record<string, unknown>;
  columns: string[];
  rows: Record<string, unknown>[];
  /** Server-side cap passed to SQL wrapper / builtin runner (echoed for UI). */
  row_limit?: number;
  raw?: Record<string, unknown>;
}

export interface ReportRegistryDefinitionItem {
  id: string;
  title: string;
  description: string;
  category: string;
  scope: string;
  parameter_schema: Record<string, unknown>;
}

export interface ReportRunRegistryResponse {
  report_id: string;
  parameters: Record<string, unknown>;
  data: Record<string, unknown>;
  /** Server cap applied to list-shaped `data.series` when present; echoed for UI. */
  row_limit: number;
}

export function useReportTemplateCatalog(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "report-templates", "catalog"],
    queryFn: async (): Promise<ReportTemplateCatalogItem[]> => {
      const { data } = await apiClient.get<ReportTemplateCatalogItem[]>(
        `/orgs/${orgSlug}/report-templates/catalog`,
      );
      return data;
    },
    enabled: !!orgSlug,
  });
}

export function useReportDefinitions(orgSlug: string | undefined, projectId: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions"],
    queryFn: async (): Promise<ReportDefinition[]> => {
      const { data } = await apiClient.get<ReportDefinition[]>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId,
  });
}

export function useReportDefinition(
  orgSlug: string | undefined,
  projectId: string | undefined,
  reportId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions", reportId],
    queryFn: async (): Promise<ReportDefinition> => {
      const { data } = await apiClient.get<ReportDefinition>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions/${reportId}`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!reportId,
  });
}

export function useCreateReportFromCatalog(orgSlug: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { catalog_key: string; name?: string | null }): Promise<ReportDefinition> => {
      const { data } = await apiClient.post<ReportDefinition>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions/from-catalog`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions"] });
    },
  });
}

export function useValidateReportDefinition(orgSlug: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string): Promise<ReportDefinition> => {
      const { data } = await apiClient.post<ReportDefinition>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions/${reportId}/validate`,
      );
      return data;
    },
    onSuccess: (_, reportId) => {
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions"] });
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions", reportId] });
      qc.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions", reportId, "execute"],
      });
    },
  });
}

export function usePublishReportDefinition(orgSlug: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string): Promise<ReportDefinition> => {
      const { data } = await apiClient.post<ReportDefinition>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions/${reportId}/publish`,
      );
      return data;
    },
    onSuccess: (_, reportId) => {
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions"] });
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions", reportId] });
      qc.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions", reportId, "execute"],
      });
    },
  });
}

export function useForkReportDefinition(orgSlug: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { sourceId: string; name?: string | null }): Promise<ReportDefinition> => {
      const { data } = await apiClient.post<ReportDefinition>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions/${args.sourceId}/fork`,
        { name: args.name ?? null },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions"] });
    },
  });
}

export function useDeleteReportDefinition(orgSlug: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string): Promise<void> => {
      await apiClient.delete(`/orgs/${orgSlug}/projects/${projectId}/report-definitions/${reportId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions"] });
    },
  });
}

export function useExecuteReportDefinition(
  orgSlug: string | undefined,
  projectId: string | undefined,
  reportId: string | undefined,
  options?: { allowDraft?: boolean; rowLimit?: number; enabled?: boolean },
) {
  const allowDraft = options?.allowDraft ?? true;
  const rowLimit = options?.rowLimit ?? 5000;
  const enabled = options?.enabled ?? !!(orgSlug && projectId && reportId);
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions", reportId, "execute", allowDraft, rowLimit],
    queryFn: async (): Promise<ReportExecuteResult> => {
      const { data } = await apiClient.get<ReportExecuteResult>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions/${reportId}/execute`,
        {
          params: {
            allow_draft: allowDraft,
            row_limit: rowLimit,
          },
        },
      );
      return data;
    },
    enabled,
  });
}

export function useReportRegistryDefinitions(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "reports", "registry", "definitions"],
    queryFn: async (): Promise<ReportRegistryDefinitionItem[]> => {
      const { data } = await apiClient.get<ReportRegistryDefinitionItem[]>(
        `/orgs/${orgSlug}/reports/definitions`,
      );
      return data;
    },
    enabled: !!orgSlug,
  });
}

export function useRunReportRegistry(orgSlug: string | undefined) {
  return useMutation({
    mutationFn: async (body: {
      report_id: string;
      parameters: Record<string, unknown>;
      row_limit?: number;
    }): Promise<ReportRunRegistryResponse> => {
      const { data } = await apiClient.post<ReportRunRegistryResponse>(
        `/orgs/${orgSlug}/reports/run`,
        body,
      );
      return data;
    },
  });
}

export interface CreateReportDefinitionBody {
  name: string;
  description?: string;
  visibility?: string;
  query_kind: "sql" | "builtin";
  builtin_report_id?: string | null;
  builtin_parameters?: Record<string, unknown>;
  sql_text?: string | null;
  sql_bind_overrides?: Record<string, unknown>;
  chart_spec?: Record<string, unknown>;
  catalog_key?: string | null;
}

export function useCreateReportDefinition(orgSlug: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReportDefinitionBody): Promise<ReportDefinition> => {
      const { data } = await apiClient.post<ReportDefinition>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions"] });
    },
  });
}

export interface UpdateReportDefinitionBody {
  name?: string | null;
  description?: string | null;
  visibility?: string | null;
  builtin_parameters?: Record<string, unknown> | null;
  sql_text?: string | null;
  sql_bind_overrides?: Record<string, unknown> | null;
  chart_spec?: Record<string, unknown> | null;
}

export function useUpdateReportDefinition(orgSlug: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { reportId: string; body: UpdateReportDefinitionBody }): Promise<ReportDefinition> => {
      const { data } = await apiClient.put<ReportDefinition>(
        `/orgs/${orgSlug}/projects/${projectId}/report-definitions/${args.reportId}`,
        args.body,
      );
      return data;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions"] });
      qc.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions", args.reportId] });
      qc.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "report-definitions", args.reportId, "execute"],
      });
    },
  });
}
