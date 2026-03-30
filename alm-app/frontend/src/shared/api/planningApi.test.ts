/**
 * E1: Unit tests for planning API display label helpers.
 */
import { describe, it, expect } from "vitest";
import {
  incrementDisplayLabel,
  areaNodeDisplayLabel,
  incrementDisplayLabelWithType,
  getReleaseNameForCycle,
} from "./planningApi";

describe("incrementDisplayLabel", () => {
  it("returns name when path is missing", () => {
    expect(incrementDisplayLabel({ name: "Sprint 1" })).toBe("Sprint 1");
  });

  it("returns name when path is empty", () => {
    expect(incrementDisplayLabel({ name: "Sprint 1", path: "" })).toBe("Sprint 1");
  });

  it("returns name (path) when path is present", () => {
    expect(incrementDisplayLabel({ name: "Sprint 1", path: "2024-Q1/S1" })).toBe(
      "Sprint 1 (2024-Q1/S1)",
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

describe("incrementDisplayLabelWithType", () => {
  it("renders release type badge", () => {
    expect(incrementDisplayLabelWithType({ name: "R1", type: "release" })).toBe("R1 · Release");
  });

  it("defaults to iteration badge when type is missing", () => {
    expect(incrementDisplayLabelWithType({ name: "I1" })).toBe("I1 · Iteration");
  });
});

describe("getReleaseNameForCycle", () => {
  const tree = [
    { id: "r1", parent_id: null, path: "Release 1", type: "release" as const },
    { id: "r2", parent_id: null, type: "release" as const },
    { id: "i1", parent_id: "r1", path: "Release 1/Iter 1", type: "iteration" as const },
    { id: "i2", parent_id: "i1", path: "Release 1/Iter 1/Sub", type: "iteration" as const },
    { id: "i3", parent_id: null, path: "Loose Iter", type: "iteration" as const },
    { id: "i4", parent_id: "r2", path: "NoPathRelease/Iter", type: "iteration" as const },
  ];

  it("returns null for missing or unknown id", () => {
    expect(getReleaseNameForCycle(null, tree)).toBeNull();
    expect(getReleaseNameForCycle("unknown", tree)).toBeNull();
  });

  it("returns release path for release node", () => {
    expect(getReleaseNameForCycle("r1", tree)).toBe("Release 1");
  });

  it("walks parents recursively for nested iterations", () => {
    expect(getReleaseNameForCycle("i2", tree)).toBe("Release 1");
  });

  it("returns null when iteration has no parent", () => {
    expect(getReleaseNameForCycle("i3", tree)).toBeNull();
  });

  it("falls back to release id when release path is missing", () => {
    expect(getReleaseNameForCycle("i4", tree)).toBe("r2");
  });
});
