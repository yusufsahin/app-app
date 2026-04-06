import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useOrgProjects } from "../api/orgApi";
import { useProjectStore } from "../stores/projectStore";

/**
 * Resolves org slug + project from URL `projectSlug` and the org project list.
 * While the project list is loading, does not fall back to Zustand (avoids stale UUIDs after DB reset).
 */
export function useOrgProjectFromRoute() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const currentProjectFromStore = useProjectStore((s) => s.currentProject);
  const project = useMemo(() => {
    const fromList = projects?.find((p) => p.slug === projectSlug);
    if (fromList) return fromList;
    if (projectsLoading) return undefined;
    return currentProjectFromStore?.slug === projectSlug ? currentProjectFromStore : undefined;
  }, [projects, projectSlug, projectsLoading, currentProjectFromStore]);

  return { orgSlug, projectSlug, project, projectsLoading };
}
