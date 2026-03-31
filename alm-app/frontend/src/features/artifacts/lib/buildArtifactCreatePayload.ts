import type { CreateArtifactRequest } from "../../../shared/api/artifactApi";
import { CORE_FIELD_KEYS, TITLE_MAX_LENGTH } from "../utils";

export type BuildArtifactCreatePayloadResult =
  | { ok: true; payload: CreateArtifactRequest }
  | { ok: false; errors: Record<string, string>; firstMessage: string };

export function buildArtifactCreatePayload(
  currentValues: Record<string, unknown>,
  options?: { fallbackArtifactType?: string },
): BuildArtifactCreatePayloadResult {
  const title = (currentValues.title as string)?.trim();
  const artifactType =
    (currentValues.artifact_type as string)?.trim() || options?.fallbackArtifactType?.trim() || "";
  const err: Record<string, string> = {};
  if (!title) err.title = "Title is required.";
  else if (title.length > TITLE_MAX_LENGTH)
    err.title = `Title must be at most ${TITLE_MAX_LENGTH} characters.`;
  if (!artifactType) err.artifact_type = "Type is required.";
  if (Object.keys(err).length > 0) {
    const firstMessage = err.title ?? err.artifact_type ?? "Please fix the form errors.";
    return { ok: false, errors: err, firstMessage };
  }

  const customFields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(currentValues)) {
    if (!CORE_FIELD_KEYS.has(key) && val !== undefined && val !== "" && val !== null) {
      customFields[key] = val;
    }
  }
  const rawParent = (currentValues.parent_id as string | null) ?? null;
  const rawAssignee = (currentValues.assignee_id as string | null) ?? null;
  const payload: CreateArtifactRequest = {
    artifact_type: artifactType,
    title,
    description: (currentValues.description as string) ?? "",
    parent_id: rawParent && String(rawParent).trim() ? String(rawParent).trim() : null,
    assignee_id: rawAssignee && String(rawAssignee).trim() ? String(rawAssignee).trim() : null,
    custom_fields: Object.keys(customFields).length ? customFields : undefined,
  };
  return { ok: true, payload };
}
