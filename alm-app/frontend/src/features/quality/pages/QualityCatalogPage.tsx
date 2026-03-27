import { useTranslation } from "react-i18next";
import QualityArtifactWorkspace from "../components/QualityArtifactWorkspace";

/** Catalog workspace: test cases organized under groups (`/quality/tests` route). */
export default function QualityCatalogPage() {
  const { t } = useTranslation("quality");
  return (
    <QualityArtifactWorkspace
      artifactType="test-case"
      pageLabel={t("pages.catalog")}
      description={t("pages.catalogDescription")}
      createCta="Create test case"
      emptyLabel={t("workspace.noTestCasesInGroup")}
      enableStepsEditor
      allowFolderCreate
      explorerMode="tree-detail"
    />
  );
}
