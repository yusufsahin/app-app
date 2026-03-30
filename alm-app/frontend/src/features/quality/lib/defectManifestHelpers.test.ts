import { describe, it, expect } from "vitest";
import { pickDefectArtifactType, findRootDefectId } from "./defectManifestHelpers";
import type { Artifact } from "../../../shared/stores/artifactStore";

describe("pickDefectArtifactType", () => {
  it("always returns defect for built-in defect tree", () => {
    expect(pickDefectArtifactType(undefined)).toBe("defect");
    expect(pickDefectArtifactType({ artifact_types: [] })).toBe("defect");
    expect(pickDefectArtifactType({ artifact_types: [{ id: "root-defect" }] })).toBe("defect");
  });
});

describe("findRootDefectId", () => {
  it("finds root-defect row", () => {
    const items = [
      { id: "x", artifact_type: "defect" },
      { id: "root", artifact_type: "root-defect" },
    ] as Artifact[];
    expect(findRootDefectId(items)).toBe("root");
  });

  it("returns null when missing", () => {
    expect(findRootDefectId(undefined)).toBeNull();
    expect(findRootDefectId([])).toBeNull();
  });
});
