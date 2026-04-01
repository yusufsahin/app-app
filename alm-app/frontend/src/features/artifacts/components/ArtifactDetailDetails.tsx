import { TabsContent } from "../../../shared/components/ui";
import type { Cadence, AreaNode } from "../../../shared/api/planningApi";
import { areaNodeDisplayLabel, getReleaseNameForCycle } from "../../../shared/api/planningApi";
import type { Artifact } from "../../../shared/api/artifactApi";

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
  return (
    <TabsContent value="details" className="py-2">
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
          {Object.entries(artifact.custom_fields).map(([key, val]) => (
            <p key={key} className="text-sm">
              {key}: {String(val)}
            </p>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
