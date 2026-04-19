import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useUpdateOrgProject } from "../../../shared/api/orgApi";
import { useOrgProjectFromRoute } from "../../../shared/hooks/useOrgProjectFromRoute";
import { useProjectStore } from "../../../shared/stores/projectStore";
import { ProjectBreadcrumbs, ProjectNotFoundView, StandardPageLayout } from "../../../shared/components/Layout";
import { ProjectScmWebhooksCard } from "../components/ProjectScmWebhooksCard";

/**
 * Project-level SCM and deploy webhook configuration (GitHub, GitLab, deploy hooks).
 */
export default function ProjectIntegrationsPage() {
  const { orgSlug, projectSlug, project, projectsLoading } = useOrgProjectFromRoute();
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const clearCurrentProject = useProjectStore((s) => s.clearCurrentProject);
  const updateProject = useUpdateOrgProject(orgSlug, project?.id);

  useEffect(() => {
    if (project) setCurrentProject(project);
    return () => clearCurrentProject();
  }, [project, setCurrentProject, clearCurrentProject]);

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }

  if (projectSlug && orgSlug && projectsLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading project…
      </div>
    );
  }

  return (
    <StandardPageLayout
      breadcrumbs={
        project ? (
          <ProjectBreadcrumbs currentPageLabel="Integrations" projectName={project.name} />
        ) : undefined
      }
      title="Integrations"
      description="Connect GitHub, GitLab, and deploy pipelines to this project via webhooks."
    >
      {orgSlug && project ? (
        <ProjectScmWebhooksCard orgSlug={orgSlug} project={project} updateProject={updateProject} />
      ) : (
        <p className="text-sm text-muted-foreground">No project selected.</p>
      )}
    </StandardPageLayout>
  );
}
