import { useTranslation } from "react-i18next";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import { QualityRunsHubPanel } from "../components/QualityRunsHubPanel";

export default function QualityRunsPage() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug, project, projectsLoading } = useBacklogWorkspaceProject();

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return (
      <div className="mx-auto max-w-5xl py-6">
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(1600px,100%)] px-4 pb-6 pt-6">
      {orgSlug && projectSlug ? (
        <ProjectBreadcrumbs
          currentPageLabel={t("runsHub.pageTitle")}
          projectName={project?.name}
          trailBeforeCurrent={[{ label: t("pages.breadcrumbQuality"), to: `/${orgSlug}/${projectSlug}/quality` }]}
          showBackToProject={false}
        />
      ) : null}
      <div className="mt-4">
        <QualityRunsHubPanel treeId="testsuites" />
      </div>
    </div>
  );
}
