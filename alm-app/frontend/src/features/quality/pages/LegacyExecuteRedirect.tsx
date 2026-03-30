import { Navigate, useParams, useSearchParams } from "react-router-dom";

/**
 * Old bookmarked `/quality/runs/:id/execute` links → runs hub + modal query params.
 */
export default function LegacyExecuteRedirect() {
  const { orgSlug, projectSlug, runId } = useParams<{
    orgSlug: string;
    projectSlug: string;
    runId: string;
  }>();
  const [sp] = useSearchParams();

  if (!orgSlug || !projectSlug || !runId) {
    return <Navigate to="/" replace />;
  }

  const qs = new URLSearchParams();
  qs.set("runExecute", runId);
  const test = sp.get("test")?.trim();
  const step = sp.get("step")?.trim();
  if (test) qs.set("runTest", test);
  if (step) qs.set("runStep", step);

  return <Navigate to={`/${orgSlug}/${projectSlug}/quality/runs?${qs.toString()}`} replace />;
}
