import { useCallback, useState } from "react";
import type { BacklogDetailTab } from "../components/BacklogArtifactDetailContent";

interface UseBacklogWorkspaceDetailStateArgs {
  detailArtifactId: string | null | undefined;
}

export function useBacklogWorkspaceDetailState({
  detailArtifactId,
}: UseBacklogWorkspaceDetailStateArgs) {
  const artifactKey = detailArtifactId ?? "";

  const [detailDrawerTabById, setDetailDrawerTabById] = useState<Record<string, BacklogDetailTab>>({});
  const [auditTargetById, setAuditTargetById] = useState<Record<string, string>>({});

  const detailDrawerTab = detailDrawerTabById[artifactKey] ?? "details";
  const auditTarget = auditTargetById[artifactKey] ?? "artifact";

  const setDetailDrawerTab = useCallback(
    (tab: BacklogDetailTab) => {
      setDetailDrawerTabById((m) => ({ ...m, [artifactKey]: tab }));
    },
    [artifactKey],
  );

  const setAuditTarget = useCallback(
    (target: string) => {
      setAuditTargetById((m) => ({ ...m, [artifactKey]: target }));
    },
    [artifactKey],
  );

  return {
    detailDrawerTab,
    setDetailDrawerTab,
    auditTarget,
    setAuditTarget,
  };
}
