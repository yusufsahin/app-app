import QualityArtifactWorkspace from "../components/QualityArtifactWorkspace";

export default function QualitySuitesPage() {
  return (
    <QualityArtifactWorkspace
      artifactType="test-suite"
      pageLabel="Test suites"
      description="Group test cases with suite links."
      createCta="Create suite"
      emptyLabel="No suites in this folder."
      linkConfig={{
        linkType: "suite_includes_test",
        targetType: "test-case",
        title: "Suite includes test",
      }}
    />
  );
}
