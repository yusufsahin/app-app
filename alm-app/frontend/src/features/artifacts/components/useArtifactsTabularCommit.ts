import { useCallback } from "react";
import { useUpdateArtifactById, type Artifact, type UpdateArtifactRequest } from "../../../shared/api/artifactApi";
import type { TabularCellCommitArgs } from "../../../shared/components/lists/types";
import type { ProblemDetail } from "../../../shared/api/types";

interface UseArtifactsTabularCommitOptions {
  orgSlug: string | undefined;
  projectId: string | undefined;
  showNotification: (message: string, severity?: "success" | "error" | "warning") => void;
}

function buildArtifactPatch(
  row: Artifact,
  fieldKey: string,
  writeTarget: string | null | undefined,
  nextValue: unknown,
): UpdateArtifactRequest {
  if (fieldKey === "title") {
    return { title: String(nextValue ?? "").trim() };
  }

  if (fieldKey === "assignee_id") {
    return { assignee_id: nextValue ? String(nextValue) : null };
  }

  if (fieldKey === "tag_ids") {
    return { tag_ids: Array.isArray(nextValue) ? nextValue.map((item) => String(item)) : [] };
  }

  if (fieldKey === "team_id") {
    return { team_id: nextValue ? String(nextValue) : null };
  }

  if (writeTarget === "custom_field") {
    return {
      custom_fields: {
        ...(row.custom_fields ?? {}),
        [fieldKey]: nextValue,
      },
    };
  }

  return {
    custom_fields: {
      ...(row.custom_fields ?? {}),
      [fieldKey]: nextValue,
    },
  };
}

function getProblemDetailMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const body = (error as { body?: ProblemDetail }).body;
  if (body?.detail) return body.detail;
  const detail = (error as { detail?: string }).detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return null;
}

export function useArtifactsTabularCommit({
  orgSlug,
  projectId,
  showNotification,
}: UseArtifactsTabularCommitOptions) {
  const updateArtifactById = useUpdateArtifactById(orgSlug, projectId);

  return useCallback(
    async ({ row, column, nextValue }: TabularCellCommitArgs<Artifact>) => {
      const patch = buildArtifactPatch(row, column.fieldKey ?? column.key, column.writeTarget, nextValue);
      try {
        await updateArtifactById.mutateAsync({ artifactId: row.id, patch });
      } catch (error) {
        const message = getProblemDetailMessage(error) ?? (error instanceof Error ? error.message : "Could not save cell.");
        showNotification(message, "error");
        throw new Error(message);
      }
    },
    [showNotification, updateArtifactById],
  );
}
