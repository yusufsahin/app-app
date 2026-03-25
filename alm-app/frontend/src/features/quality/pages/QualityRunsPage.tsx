import QualityArtifactWorkspace from "../components/QualityArtifactWorkspace";

export default function QualityRunsPage() {
  return (
    <QualityArtifactWorkspace
      artifactType="test-run"
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
    />
  );
}
