import { useTranslation } from "react-i18next";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui/tabs";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import QualityArtifactWorkspace from "../components/QualityArtifactWorkspace";
import { QualityRunsHubPanel } from "../components/QualityRunsHubPanel";

export default function QualityRunsPage() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug, project, projectsLoading } = useArtifactsPageProject();

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

      <Tabs defaultValue="all" className="mt-2">
        <TabsList className="h-10 w-full justify-start rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="rounded-none border-b-2 border-transparent px-4 pb-2 pt-2 data-[state=active]:border-primary"
            data-testid="quality-runs-tab-all"
          >
            {t("runsHub.tabAllRuns")}
          </TabsTrigger>
          <TabsTrigger
            value="by-folder"
            className="rounded-none border-b-2 border-transparent px-4 pb-2 pt-2 data-[state=active]:border-primary"
            data-testid="quality-runs-tab-by-folder"
          >
            {t("runsHub.tabByFolder")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <QualityRunsHubPanel treeId="testsuites" />
        </TabsContent>
        <TabsContent value="by-folder" className="mt-4">
          <QualityArtifactWorkspace
            artifactType="test-run"
            treeId="testsuites"
            rootArtifactType="root-testsuites"
            folderArtifactType="testsuite-folder"
            pageLabel="Test runs"
            description="Execution records linked to suites."
            createCta="Create run"
            emptyLabel="No runs in this folder."
            linkConfig={{
              linkType: "run_for_suite",
              targetType: "test-suite",
              title: "Run for suite",
            }}
            runExecute
            allowFolderCreate
            explorerMode="tree-detail"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
