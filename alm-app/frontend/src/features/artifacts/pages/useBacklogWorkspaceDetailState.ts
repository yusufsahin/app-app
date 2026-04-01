import { useEffect, useState } from "react";
import type { BacklogDetailTab } from "../components/BacklogArtifactDetailContent";

interface UseBacklogWorkspaceDetailStateArgs {
  detailArtifactId: string | null | undefined;
}

export function useBacklogWorkspaceDetailState({
  detailArtifactId,
}: UseBacklogWorkspaceDetailStateArgs) {
  const [detailDrawerTab, setDetailDrawerTab] = useState<BacklogDetailTab>("details");
  const [auditTarget, setAuditTarget] = useState<string>("artifact");

  useEffect(() => {
    setDetailDrawerTab("details");
  }, [detailArtifactId]);

  useEffect(() => {
    setAuditTarget("artifact");
  }, [detailArtifactId]);

  return {
    detailDrawerTab,
    setDetailDrawerTab,
    auditTarget,
    setAuditTarget,
  };
}
