import QualityArtifactWorkspace from "../components/QualityArtifactWorkspace";

export default function QualityTestsPage() {
  return (
    <QualityArtifactWorkspace
      artifactType="test-case"
      pageLabel="Test cases"
      description="Manual and automated tests under selected quality folder."
      createCta="Create test case"
      emptyLabel="No test cases in this folder."
      enableStepsEditor
      allowFolderCreate
    />
  );
}
