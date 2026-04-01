/**
 * E1: Unit tests for app path helpers.
 */
import { describe, it, expect } from "vitest";
import {
  backlogPath,
  artifactsPath,
  artifactDetailPath,
  qualityPath,
  qualityTraceabilityPath,
  qualityCatalogPath,
  qualityCatalogArtifactPath,
  qualityCampaignPath,
  qualityDefectsPath,
  requirementsTraceabilityPath,
} from "./appPaths";

describe("backlogPath", () => {
  it("returns base path when no params", () => {
    expect(backlogPath("my-org", "my-project")).toBe("/my-org/my-project/backlog");
  });

  it("adds artifact query param", () => {
    expect(backlogPath("o", "p", { artifact: "aid-1" })).toBe("/o/p/backlog?artifact=aid-1");
  });

  it("adds state and type", () => {
    expect(backlogPath("o", "p", { state: "active", type: "story" })).toBe(
      "/o/p/backlog?state=active&type=story",
    );
  });

  it("adds cycleFilter to the backlog query string", () => {
    expect(backlogPath("o", "p", { cycleFilter: "cycle-1" })).toBe(
      "/o/p/backlog?cycle_id=cycle-1",
    );
  });

  it("adds releaseFilter to the backlog query string", () => {
    expect(backlogPath("o", "p", { releaseFilter: "release-1" })).toBe(
      "/o/p/backlog?release_id=release-1",
    );
  });

  it("adds areaNodeFilter as area_node_id", () => {
    expect(backlogPath("o", "p", { areaNodeFilter: "area-1" })).toBe(
      "/o/p/backlog?area_node_id=area-1",
    );
  });

  it("combines multiple params", () => {
    const path = backlogPath("org", "proj", {
      artifact: "a1",
      state: "new",
      releaseFilter: "r1",
      cycleFilter: "c1",
      areaNodeFilter: "a1",
    });
    expect(path).toContain("/org/proj/backlog?");
    expect(path).toContain("artifact=a1");
    expect(path).toContain("state=new");
      expect(path).toContain("release_id=r1");
    expect(path).toContain("cycle_id=c1");
    expect(path).toContain("area_node_id=a1");
  });
});

describe("artifactsPath alias", () => {
  it("matches backlogPath during the cutover", () => {
    expect(artifactsPath("org", "proj", { artifact: "art-1" })).toBe(
      backlogPath("org", "proj", { artifact: "art-1" }),
    );
  });
});

describe("artifactDetailPath", () => {
  it("returns route-based backlog detail path", () => {
    expect(artifactDetailPath("org", "proj", "art-123")).toBe(
      "/org/proj/backlog/art-123",
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

describe("qualityDefectsPath", () => {
  it("returns defects subpath when no params", () => {
    expect(qualityDefectsPath("my-org", "my-proj")).toBe("/my-org/my-proj/quality/defects");
  });

  it("adds page, q, and state when provided", () => {
    expect(qualityDefectsPath("o", "p", { page: 2, q: "crash", state: "open" })).toBe(
      "/o/p/quality/defects?page=2&q=crash&state=open",
    );
  });

  it("omits page when 1 or unset with only q", () => {
    expect(qualityDefectsPath("o", "p", { page: 1, q: "x" })).toBe("/o/p/quality/defects?q=x");
  });

  it("returns base when page 1 and no q or state", () => {
    expect(qualityDefectsPath("o", "p", { page: 1 })).toBe("/o/p/quality/defects");
  });

  it("adds under when provided alone", () => {
    expect(qualityDefectsPath("o", "p", { under: "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee" })).toBe(
      "/o/p/quality/defects?under=aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee",
    );
  });
});

describe("requirementsTraceabilityPath", () => {
  it("returns traceability matrix path when no params", () => {
    expect(requirementsTraceabilityPath("o", "p")).toBe("/o/p/requirements/traceability");
  });

  it("adds filters and tab params", () => {
    expect(
      requirementsTraceabilityPath("o", "p", {
        under: "u1",
        scopeRun: "r1",
        q: "login",
        reverse: false,
        tab: "relationships",
      }),
    ).toBe("/o/p/requirements/traceability?under=u1&scopeRun=r1&q=login&reverse=0&tab=relationships");
  });
});
