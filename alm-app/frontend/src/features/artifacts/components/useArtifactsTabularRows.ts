import { useMemo } from "react";
import type { Artifact } from "../../../shared/api/artifactApi";

export function useArtifactsTabularRows(artifacts: Artifact[]): Artifact[] {
  return useMemo(() => artifacts, [artifacts]);
}
