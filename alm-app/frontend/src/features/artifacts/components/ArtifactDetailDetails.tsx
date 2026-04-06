import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TabsContent, Button, Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/components/ui";
import type { Cadence, AreaNode } from "../../../shared/api/planningApi";
import { areaNodeDisplayLabel, getReleaseNameForCycle } from "../../../shared/api/planningApi";
import type { Artifact } from "../../../shared/api/artifactApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

interface ArtifactDetailDetailsProps {
  artifact: Artifact;
  cadencesFlat: Cadence[];
  areaNodesFlat: AreaNode[];
}

export function ArtifactDetailDetails({
  artifact,
  cadencesFlat,
  areaNodesFlat,
}: ArtifactDetailDetailsProps) {
  const { t } = useTranslation("quality");
  const showNotification = useNotificationStore((s) => s.showNotification);
  const key = artifact.artifact_key?.trim();

  return (
    <TabsContent value="details" className="py-2">
      {key ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("workItemDetail.details.artifactKeyLabel")}</span>
          <code className="rounded bg-muted px-2 py-0.5 font-mono text-foreground">{key}</code>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("workItemDetail.details.copyKeyAria")}
                onClick={() => {
                  void navigator.clipboard.writeText(key).then(
                    () => showNotification(t("workItemDetail.details.keyCopied"), "success"),
                    () => showNotification(t("workItemDetail.details.copyKeyFailed"), "error"),
                  );
                }}
              >
                <Copy className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("workItemDetail.details.copyKeyAria")}</TooltipContent>
          </Tooltip>
        </div>
      ) : null}
      {artifact.description && (
        <p className="mb-4 text-sm">{artifact.description}</p>
      )}
      {artifact.state_reason && (
        <p className="mb-2 text-sm">
          <strong>State reason:</strong> {artifact.state_reason}
        </p>
      )}
      {artifact.resolution && (
        <p className="mb-4 text-sm">
          <strong>Resolution:</strong> {artifact.resolution}
        </p>
      )}
      {(artifact.cycle_id || artifact.area_node_id) && (
        <p className="mb-4 text-sm">
          {artifact.cycle_id && (
            <>
              <strong>Cycle:</strong>{" "}
              {(() => {
                const cycle = cadencesFlat.find((c) => c.id === artifact.cycle_id);
                const cycleLabel = cycle?.path || cycle?.name || artifact.cycle_id;
                const releaseName = getReleaseNameForCycle(artifact.cycle_id, cadencesFlat);
                return releaseName ? `${cycleLabel} · ${releaseName}` : cycleLabel;
              })()}
            </>
          )}
          {artifact.cycle_id && artifact.area_node_id && " · "}
          {artifact.area_node_id && (
            <>
              <strong>Area:</strong>{" "}
              {(() => {
                const area = areaNodesFlat.find((node) => node.id === artifact.area_node_id);
                return area ? areaNodeDisplayLabel(area) : artifact.area_node_id;
              })()}
            </>
          )}
        </p>
      )}
      {artifact.custom_fields && Object.keys(artifact.custom_fields).length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Custom fields</p>
          {Object.entries(artifact.custom_fields).map(([k, val]) => (
            <p key={k} className="text-sm">
              {k}: {String(val)}
            </p>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
