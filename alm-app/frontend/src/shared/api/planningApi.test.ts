/**
 * E1: Unit tests for planning API display label helpers.
 */
import { describe, it, expect } from "vitest";
import {
  cadenceDisplayLabel,
  areaNodeDisplayLabel,
  cadenceDisplayLabelWithType,
  getReleaseNameForCycle,
} from "./planningApi";

describe("cadenceDisplayLabel", () => {
  it("returns name when path is missing", () => {
    expect(cadenceDisplayLabel({ name: "Cycle 1" })).toBe("Cycle 1");
  });

  it("returns name when path is empty", () => {
    expect(cadenceDisplayLabel({ name: "Cycle 1", path: "" })).toBe("Cycle 1");
  });

  it("returns name (path) when path is present", () => {
    expect(cadenceDisplayLabel({ name: "Cycle 1", path: "2024-Q1/C1" })).toBe(
      "Cycle 1 (2024-Q1/C1)",
    );
  });
});

describe("areaNodeDisplayLabel", () => {
  it("returns name when path is missing", () => {
    expect(areaNodeDisplayLabel({ name: "Backend" })).toBe("Backend");
  });

  it("returns name (path) when path is present", () => {
    expect(areaNodeDisplayLabel({ name: "Backend", path: "Engineering/Backend" })).toBe(
      "Backend (Engineering/Backend)",
    );
  });
});

describe("cadenceDisplayLabelWithType", () => {
  it("renders release type badge", () => {
    expect(cadenceDisplayLabelWithType({ name: "R1", type: "release" })).toBe("R1 · Release");
  });

  it("defaults to cycle badge when type is missing", () => {
    expect(cadenceDisplayLabelWithType({ name: "C1" })).toBe("C1 · Cycle");
  });
});

describe("getReleaseNameForCycle", () => {
  const tree = [
    { id: "r1", parent_id: null, path: "Release 1", type: "release" as const },
    { id: "r2", parent_id: null, type: "release" as const },
    { id: "c1", parent_id: "r1", path: "Release 1/Cycle 1", type: "cycle" as const },
    { id: "c2", parent_id: "c1", path: "Release 1/Cycle 1/Sub", type: "cycle" as const },
    { id: "c3", parent_id: null, path: "Loose Cycle", type: "cycle" as const },
    { id: "c4", parent_id: "r2", path: "NoPathRelease/Cycle", type: "cycle" as const },
  ];

  it("returns null for missing or unknown id", () => {
    expect(getReleaseNameForCycle(null, tree)).toBeNull();
    expect(getReleaseNameForCycle("unknown", tree)).toBeNull();
  });

  it("returns release path for release node", () => {
    expect(getReleaseNameForCycle("r1", tree)).toBe("Release 1");
  });

  it("walks parents recursively for nested cycles", () => {
    expect(getReleaseNameForCycle("c2", tree)).toBe("Release 1");
  });

  it("returns null when cycle has no parent", () => {
    expect(getReleaseNameForCycle("c3", tree)).toBeNull();
  });

  it("falls back to release id when release path is missing", () => {
    expect(getReleaseNameForCycle("c4", tree)).toBe("r2");
  });
});
