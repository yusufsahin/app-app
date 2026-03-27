/**
 * E1: Unit tests for app path helpers.
 */
import { describe, it, expect } from "vitest";
import {
  artifactsPath,
  artifactDetailPath,
  qualityPath,
  qualityTraceabilityPath,
  qualityCatalogPath,
  qualityCatalogArtifactPath,
  qualityCampaignPath,
} from "./appPaths";

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

describe("qualityPath", () => {
  it("returns base quality path", () => {
    expect(qualityPath("o", "p")).toBe("/o/p/quality");
  });

  it("adds artifact and tree", () => {
    expect(qualityPath("o", "p", { artifact: "a1", tree: "quality" })).toBe(
      "/o/p/quality?artifact=a1&tree=quality",
    );
  });

  it("adds only artifact", () => {
    expect(qualityPath("org", "proj", { artifact: "x" })).toBe("/org/proj/quality?artifact=x");
  });

  it("encodes special characters in query values", () => {
    expect(qualityPath("o", "p", { artifact: "id/with&chars", tree: "quality" })).toContain("artifact=");
    const u = new URL(qualityPath("o", "p", { artifact: "a&b", tree: "quality" }), "http://localhost");
    expect(u.searchParams.get("artifact")).toBe("a&b");
  });
});

describe("qualityTraceabilityPath", () => {
  it("returns traceability subpath", () => {
    expect(qualityTraceabilityPath("my-org", "my-proj")).toBe("/my-org/my-proj/quality/traceability");
  });

  it("adds page and q when provided", () => {
    expect(qualityTraceabilityPath("o", "p", { page: 2, q: "login" })).toBe(
      "/o/p/quality/traceability?page=2&q=login",
    );
  });

  it("omits page when 1", () => {
    expect(qualityTraceabilityPath("o", "p", { page: 1, q: "x" })).toBe("/o/p/quality/traceability?q=x");
  });
});

describe("quality section paths", () => {
  it("returns catalog (tests) and campaign workspace paths", () => {
    expect(qualityCatalogPath("o", "p")).toBe("/o/p/quality/catalog");
    expect(qualityCampaignPath("o", "p")).toBe("/o/p/quality/campaign");
  });

  it("builds catalog artifact URL with under and artifact", () => {
    expect(qualityCatalogArtifactPath("o", "p", "tc-1", "folder-2")).toBe(
      "/o/p/quality/catalog?under=folder-2&artifact=tc-1",
    );
  });

  it("builds catalog artifact URL with artifact only when under omitted", () => {
    expect(qualityCatalogArtifactPath("o", "p", "tc-1")).toBe("/o/p/quality/catalog?artifact=tc-1");
  });
});
