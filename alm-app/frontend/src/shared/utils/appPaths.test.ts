/**
 * E1: Unit tests for app path helpers.
 */
import { describe, it, expect } from "vitest";
import { artifactsPath, artifactDetailPath } from "./appPaths";

describe("artifactsPath", () => {
  it("returns base path when no params", () => {
    expect(artifactsPath("my-org", "my-project")).toBe("/my-org/my-project/artifacts");
  });

  it("adds artifact query param", () => {
    expect(artifactsPath("o", "p", { artifact: "aid-1" })).toBe("/o/p/artifacts?artifact=aid-1");
  });

  it("adds state and type", () => {
    expect(artifactsPath("o", "p", { state: "active", type: "story" })).toBe(
      "/o/p/artifacts?state=active&type=story",
    );
  });

  it("adds cycleNodeFilter as cycle_node_id", () => {
    expect(artifactsPath("o", "p", { cycleNodeFilter: "cycle-1" })).toBe(
      "/o/p/artifacts?cycle_node_id=cycle-1",
    );
  });

  it("adds areaNodeFilter as area_node_id", () => {
    expect(artifactsPath("o", "p", { areaNodeFilter: "area-1" })).toBe(
      "/o/p/artifacts?area_node_id=area-1",
    );
  });

  it("combines multiple params", () => {
    const path = artifactsPath("org", "proj", {
      artifact: "a1",
      state: "new",
      cycleNodeFilter: "c1",
      areaNodeFilter: "a1",
    });
    expect(path).toContain("/org/proj/artifacts?");
    expect(path).toContain("artifact=a1");
    expect(path).toContain("state=new");
    expect(path).toContain("cycle_node_id=c1");
    expect(path).toContain("area_node_id=a1");
  });
});

describe("artifactDetailPath", () => {
  it("returns path with artifact query", () => {
    expect(artifactDetailPath("org", "proj", "art-123")).toBe(
      "/org/proj/artifacts?artifact=art-123",
    );
  });
});
