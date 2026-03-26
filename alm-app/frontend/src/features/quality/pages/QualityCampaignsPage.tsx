import QualityArtifactWorkspace from "../components/QualityArtifactWorkspace";

export default function QualityCampaignsPage() {
  return (
    <QualityArtifactWorkspace
      artifactType="test-campaign"
      treeId="testsuites"
      rootArtifactType="root-testsuites"
      folderArtifactType="testsuite-folder"
      pageLabel="Test campaigns"
      description="Campaigns group suite execution."
      createCta="Create campaign"
      emptyLabel="No campaigns in this folder."
      linkConfig={{
        linkType: "campaign_includes_suite",
        targetType: "test-suite",
        title: "Campaign includes suite",
      }}
      allowFolderCreate
    />
  );
}
