import type { NavigateFunction } from "react-router-dom";

/**
 * Single tab row in the test run modal: detail panes + Runner (manual player).
 * URL query: `runTab` (optional; default when absent = summary).
 */
export const RUN_MODAL_TABS = [
  "summary",
  "steps",
  "parameters",
  "linked",
  "attachments",
  "history",
  "runner",
] as const;

export type RunModalTab = (typeof RUN_MODAL_TABS)[number];

const RUN_MODAL_TAB_SET = new Set<string>(RUN_MODAL_TABS);

/** Overview tabs only (excludes Runner); used with `runOverviewTab` query on the details view. */
export const RUN_OVERVIEW_TABS = [
  "summary",
  "steps",
  "parameters",
  "linked",
  "attachments",
  "history",
] as const;

export type RunOverviewTab = (typeof RUN_OVERVIEW_TABS)[number];

const RUN_OVERVIEW_TAB_SET = new Set<string>(RUN_OVERVIEW_TABS);

export function parseRunOverviewTabParam(raw: string | null | undefined): RunOverviewTab {
  const s = (raw ?? "").trim();
  if (s && RUN_OVERVIEW_TAB_SET.has(s)) return s as RunOverviewTab;
  return "summary";
}

export function parseRunTabParam(raw: string | null | undefined): RunModalTab {
  const s = (raw ?? "").trim();
  if (s && RUN_MODAL_TAB_SET.has(s)) return s as RunModalTab;
  return "summary";
}

function buildRunModalSearch(
  runId: string,
  opts: {
    runTab?: RunModalTab;
    test?: string;
    step?: string;
  } = {},
): string {
  const sp = new URLSearchParams();
  sp.set("runExecute", runId);
  const tab = opts.runTab ?? "summary";
  if (tab !== "summary") {
    sp.set("runTab", tab);
  }
  const test = opts.test?.trim();
  const step = opts.step?.trim();
  if (test) sp.set("runTest", test);
  if (step) sp.set("runStep", step);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Navigate to Quality → Runs with `runExecute` + `runTab=runner` so {@link ManualExecutionModalHost}
 * opens the manual runner in the modal.
 */
export function navigateToManualExecution(
  navigate: NavigateFunction,
  orgSlug: string,
  projectSlug: string,
  runId: string,
  opts?: {
    test?: string;
    step?: string;
    replace?: boolean;
  },
) {
  const search = buildRunModalSearch(runId, {
    runTab: "runner",
    test: opts?.test,
    step: opts?.step,
  });
  navigate(
    {
      pathname: `/${orgSlug}/${projectSlug}/quality/runs`,
      search,
    },
    { replace: opts?.replace ?? false },
  );
}

/** Navigate to run modal with a detail tab (default summary). */
export function navigateToRunDetails(
  navigate: NavigateFunction,
  orgSlug: string,
  projectSlug: string,
  runId: string,
  opts?: {
    replace?: boolean;
    runTab?: RunModalTab;
  },
) {
  const tab = opts?.runTab ?? "summary";
  const search = buildRunModalSearch(runId, {
    runTab: tab === "summary" ? undefined : tab,
  });
  navigate(
    {
      pathname: `/${orgSlug}/${projectSlug}/quality/runs`,
      search,
    },
    { replace: opts?.replace ?? false },
  );
}
