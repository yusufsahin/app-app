import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";

/**
 * Resolves org slug + project slug from the URL and org project list (with store fallback).
 */
export function useArtifactsPageProject() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const currentProjectFromStore = useProjectStore((s) => s.currentProject);
  const project = useMemo(
    () =>
      projects?.find((p) => p.slug === projectSlug) ??
      (currentProjectFromStore?.slug === projectSlug ? currentProjectFromStore : undefined),
    [projects, projectSlug, currentProjectFromStore],
  );

  return { orgSlug, projectSlug, project, projectsLoading };
}
