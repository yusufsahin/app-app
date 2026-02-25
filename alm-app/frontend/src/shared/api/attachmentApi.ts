/**
 * Attachment API: artifact file attachments (list, upload, download, delete).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface Attachment {
  id: string;
  project_id: string;
  artifact_id: string;
  file_name: string;
  content_type: string;
  size: number;
  created_by: string | null;
  created_at: string | null;
}

export function useAttachments(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "attachments"],
    queryFn: async (): Promise<Attachment[]> => {
      const { data } = await apiClient.get<Attachment[]>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/attachments`,
      );
      return data;
    },
    enabled: !!orgSlug && !!projectId && !!artifactId,
  });
}

export function useUploadAttachment(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<Attachment> => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<Attachment>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/attachments`,
        formData,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "attachments"],
      });
    },
  });
}

export function useDeleteAttachment(
  orgSlug: string | undefined,
  projectId: string | undefined,
  artifactId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachmentId: string): Promise<void> => {
      await apiClient.delete(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/attachments/${attachmentId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", artifactId, "attachments"],
      });
    },
  });
}

/** Download attachment as blob (uses auth from apiClient). Call with orgSlug, projectId, artifactId, attachment, then trigger save. */
export async function downloadAttachmentBlob(
  orgSlug: string,
  projectId: string,
  artifactId: string,
  attachmentId: string,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/attachments/${attachmentId}`,
    { responseType: "blob" },
  );
  return data;
}
