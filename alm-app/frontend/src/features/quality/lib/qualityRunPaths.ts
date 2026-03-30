/** UUID v4 pattern for artifact ids in URLs. */
export function isArtifactUuid(id: string | null | undefined): id is string {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export type QualityRunExecuteQuery = {
  /** Compact layout for side-by-side manual runner + SUT. */
  popout?: boolean;
  /** Deep-link: test case artifact id. */
  test?: string;
  /** Deep-link: step id (matches TestStep.id). */
  step?: string;
};

/** Search params that open `ManualExecutionModalHost` on the Quality runs page. */
function appendRunExecuteQuery(
  runsPath: string,
  runId: string,
  query?: QualityRunExecuteQuery,
): string {
  const sp = new URLSearchParams();
  sp.set("runExecute", runId);
  if (query?.test?.trim()) sp.set("runTest", query.test.trim());
  if (query?.step?.trim()) sp.set("runStep", query.step.trim());
  const q = sp.toString();
  return q ? `${runsPath}?${q}` : runsPath;
}

/** Path to open manual execution in-app (modal on `/quality/runs`). */
export function qualityRunExecutePath(
  orgSlug: string,
  projectSlug: string,
  runId: string,
  query?: QualityRunExecuteQuery,
): string {
  const base = `/${orgSlug}/${projectSlug}/quality/runs`;
  return appendRunExecuteQuery(base, runId, query);
}

/** Full URL for sharing (auth required). */
export function qualityRunExecuteAbsoluteUrl(
  origin: string,
  orgSlug: string,
  projectSlug: string,
  runId: string,
  query?: QualityRunExecuteQuery,
): string {
  const path = qualityRunExecutePath(orgSlug, projectSlug, runId, query);
  return `${origin.replace(/\/$/, "")}${path}`;
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
