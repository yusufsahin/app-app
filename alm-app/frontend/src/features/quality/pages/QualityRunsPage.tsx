import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui/tabs";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import QualityArtifactWorkspace from "../components/QualityArtifactWorkspace";
import { QualityRunsHubPanel } from "../components/QualityRunsHubPanel";

export default function QualityRunsPage() {
  const { t } = useTranslation("quality");
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgSlug, projectSlug, project, projectsLoading } = useArtifactsPageProject();
  const hasWorkspaceSelection = useMemo(
    () => Boolean(searchParams.get("artifact") || searchParams.get("under")),
    [searchParams],
  );
  const [runsTab, setRunsTab] = useState(hasWorkspaceSelection ? "by-folder" : "all");

  useEffect(() => {
    if (hasWorkspaceSelection && runsTab !== "by-folder") {
      setRunsTab("by-folder");
    }
  }, [hasWorkspaceSelection, runsTab]);

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return (
      <div className="mx-auto max-w-5xl py-6">
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(1600px,100%)] px-4 pb-6 pt-6">
      {runsTab === "all" && orgSlug && projectSlug ? (
        <ProjectBreadcrumbs
          currentPageLabel={t("runsHub.pageTitle")}
          projectName={project?.name}
          trailBeforeCurrent={[{ label: t("pages.breadcrumbQuality"), to: `/${orgSlug}/${projectSlug}/quality` }]}
          showBackToProject={false}
        />
      ) : null}

      <Tabs
        value={runsTab}
        onValueChange={(value) => {
          setRunsTab(value);
          if (value === "all") {
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.delete("under");
                next.delete("artifact");
                return next;
              },
              { replace: true },
            );
          }
        }}
        className="mt-2"
      >
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
            pageLabel={t("runsHub.workspacePageLabel")}
            description={t("runsHub.workspaceDescription")}
            createCta={t("runsHub.workspaceCreateCta")}
            emptyLabel={t("runsHub.workspaceEmptyFolder")}
            linkConfig={{
              linkType: "run_for_suite",
              targetType: "test-suite",
              title: t("runsHub.linkRunForSuite"),
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
