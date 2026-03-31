import QualityArtifactWorkspace from "../components/QualityArtifactWorkspace";

/** Quality → Campaign: test suites under collections (`tree_id` **testsuites** in manifest). */
export default function QualityCampaignPage() {
  return (
    <QualityArtifactWorkspace
      artifactType="test-suite"
      treeId="testsuites"
      linkTargetTreeId="quality"
      rootArtifactType="root-testsuites"
      folderArtifactType="testsuite-folder"
      pageLabel="Campaign"
      description="Organize test suites in collections and link test cases."
      createCta="Create suite"
      emptyLabel="No suites in this collection."
      linkConfig={{
        linkType: "suite_includes_test",
        targetType: "test-case",
        title: "Suite includes test",
      }}
      allowFolderCreate
      explorerMode="tree-detail"
    />
  );
}
