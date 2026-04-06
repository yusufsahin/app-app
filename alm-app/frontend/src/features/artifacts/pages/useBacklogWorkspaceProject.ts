import { useOrgProjectFromRoute } from "../../../shared/hooks/useOrgProjectFromRoute";

/**
 * Resolves org slug + project slug from the URL and org project list (with store fallback).
 */
export function useBacklogWorkspaceProject() {
  return useOrgProjectFromRoute();
}
