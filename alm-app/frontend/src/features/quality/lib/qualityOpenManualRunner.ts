import { qualityRunExecuteAbsoluteUrl, type QualityRunExecuteQuery } from "./qualityRunPaths";

export const MANUAL_RUNNER_WINDOW_NAME = "alm-manual-runner";

const DEFAULT_FEATURES = "width=520,height=820,noopener,noreferrer";

/**
 * Open manual execution in a separate window (user gesture required to avoid popup blockers).
 * Reuses/focuses the same window name across clicks.
 */
export function openManualRunnerInNewWindow(
  orgSlug: string,
  projectSlug: string,
  runId: string,
  query?: QualityRunExecuteQuery,
  features: string = DEFAULT_FEATURES,
): Window | null {
  if (typeof window === "undefined") return null;
  const url = qualityRunExecuteAbsoluteUrl(window.location.origin, orgSlug, projectSlug, runId, {
    popout: true,
    ...query,
  });
  return window.open(url, MANUAL_RUNNER_WINDOW_NAME, features);
}
