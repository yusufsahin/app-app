/** UUID v4 pattern for artifact ids in URLs. */
export function isArtifactUuid(id: string | null | undefined): id is string {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function qualityRunExecutePath(orgSlug: string, projectSlug: string, runId: string): string {
  return `/${orgSlug}/${projectSlug}/quality/runs/${runId}/execute`;
}

export function qualityRunWorkspaceDetailPath(
  orgSlug: string,
  projectSlug: string,
  runId: string,
  parentId?: string | null,
): string {
  const base = `/${orgSlug}/${projectSlug}/quality/runs`;
  if (parentId && isArtifactUuid(parentId)) {
    return `${base}?under=${encodeURIComponent(parentId)}&artifact=${encodeURIComponent(runId)}`;
  }
  return `${base}?artifact=${encodeURIComponent(runId)}`;
}
