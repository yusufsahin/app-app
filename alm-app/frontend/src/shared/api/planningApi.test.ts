/**
 * E1: Unit tests for planning API display label helpers.
 */
import { describe, it, expect } from "vitest";
import { cycleNodeDisplayLabel, areaNodeDisplayLabel } from "./planningApi";

describe("cycleNodeDisplayLabel", () => {
  it("returns name when path is missing", () => {
    expect(cycleNodeDisplayLabel({ name: "Sprint 1" })).toBe("Sprint 1");
  });

  it("returns name when path is empty", () => {
    expect(cycleNodeDisplayLabel({ name: "Sprint 1", path: "" })).toBe("Sprint 1");
  });

  it("returns name (path) when path is present", () => {
    expect(cycleNodeDisplayLabel({ name: "Sprint 1", path: "2024-Q1/S1" })).toBe(
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
