/**
 * E1: Unit tests for planning API display label helpers.
 */
import { describe, it, expect } from "vitest";
import { incrementDisplayLabel, areaNodeDisplayLabel } from "./planningApi";

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
