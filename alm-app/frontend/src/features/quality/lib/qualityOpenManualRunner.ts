import type { NavigateFunction, Location } from "react-router-dom";

/**
 * Navigate to Quality → Runs with `runExecute` search params so {@link ManualExecutionModalHost}
 * opens the manual runner in a modal (no separate /execute page).
 */
export function navigateToManualExecution(
  navigate: NavigateFunction,
  orgSlug: string,
  projectSlug: string,
  runId: string,
  opts?: {
    /** When already on `/quality/runs`, existing query (e.g. `under`, `artifact`) is preserved. */
    location?: Pick<Location, "pathname" | "search">;
    test?: string;
    step?: string;
    replace?: boolean;
  },
) {
  const onRuns = opts?.location?.pathname.replace(/\/+$/, "").endsWith("/quality/runs") ?? false;
  const sp = onRuns
    ? new URLSearchParams((opts!.location!.search || "").replace(/^\?/, ""))
    : new URLSearchParams();

  sp.set("runExecute", runId);
  const test = opts?.test?.trim();
  const step = opts?.step?.trim();
  if (test) sp.set("runTest", test);
  else sp.delete("runTest");
  if (step) sp.set("runStep", step);
  else sp.delete("runStep");

  const search = sp.toString();
  navigate(
    {
      pathname: `/${orgSlug}/${projectSlug}/quality/runs`,
      search: search ? `?${search}` : "",
    },
    { replace: opts?.replace ?? false },
  );
}
