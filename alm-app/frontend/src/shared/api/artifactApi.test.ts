/**
 * E1: Unit tests for artifact list params builder and batch transition response shape.
 */
import { describe, it, expect } from "vitest";
import { buildArtifactListParams, type BatchResultResponse } from "./artifactApi";

describe("buildArtifactListParams", () => {
  it("returns empty object when no options", () => {
    expect(buildArtifactListParams({})).toEqual({});
  });

  it("maps state and type filters", () => {
    expect(
      buildArtifactListParams({ stateFilter: "active", typeFilter: "requirement" }),
    ).toEqual({ state: "active", type: "requirement" });
  });

  it("maps sort_by and sort_order", () => {
    expect(
      buildArtifactListParams({ sortBy: "updated_at", sortOrder: "desc" }),
    ).toEqual({ sort_by: "updated_at", sort_order: "desc" });
  });

  it("trims and omits empty search query", () => {
    expect(buildArtifactListParams({ searchQuery: "  " })).toEqual({});
    expect(buildArtifactListParams({ searchQuery: " foo " })).toEqual({ q: "foo" });
  });

  it("maps limit and offset", () => {
    expect(buildArtifactListParams({ limit: 20, offset: 40 })).toEqual({
      limit: 20,
      offset: 40,
    });
  });

  it("includes include_deleted when true", () => {
    expect(buildArtifactListParams({ includeDeleted: true })).toEqual({
      include_deleted: true,
    });
    expect(buildArtifactListParams({ includeDeleted: false })).toEqual({});
  });

  it("maps cycle_node_id and area_node_id", () => {
    expect(
      buildArtifactListParams({ cycleNodeId: "c1", areaNodeId: "a1" }),
    ).toEqual({ cycle_node_id: "c1", area_node_id: "a1" });
  });

  it("omits null cycle_node_id and area_node_id", () => {
    expect(
      buildArtifactListParams({ cycleNodeId: null, areaNodeId: undefined }),
    ).toEqual({});
  });

  it("prefers release_cycle_node_id when releaseCycleNodeId is set", () => {
    expect(
      buildArtifactListParams({ releaseCycleNodeId: "r1", cycleNodeId: "c1", areaNodeId: "a1" }),
    ).toEqual({ release_cycle_node_id: "r1", area_node_id: "a1" });
  });

  it("includes tree when requirement, quality, or defect", () => {
    expect(buildArtifactListParams({ tree: "requirement" })).toEqual({ tree: "requirement" });
    expect(buildArtifactListParams({ tree: "quality" })).toEqual({ tree: "quality" });
    expect(buildArtifactListParams({ tree: "defect" })).toEqual({ tree: "defect" });
    expect(buildArtifactListParams({ tree: "" })).toEqual({});
    expect(buildArtifactListParams({ tree: "other" })).toEqual({});
  });

  it("combines all params", () => {
    expect(
      buildArtifactListParams({
        stateFilter: "new",
        typeFilter: "story",
        sortBy: "created_at",
        sortOrder: "asc",
        searchQuery: "bug",
        limit: 10,
        offset: 0,
        cycleNodeId: "cycle-1",
      }),
    ).toEqual({
      state: "new",
      type: "story",
      sort_by: "created_at",
      sort_order: "asc",
      q: "bug",
      limit: 10,
      offset: 0,
      cycle_node_id: "cycle-1",
    });
  });
});

describe("BatchResultResponse", () => {
  it("allows success with per-artifact results", () => {
    const res: BatchResultResponse = {
      success_count: 2,
      error_count: 0,
      errors: [],
      results: { "id-1": "ok", "id-2": "ok" },
    };
    expect(res.results?.["id-1"]).toBe("ok");
    expect(res.results?.["id-2"]).toBe("ok");
  });

  it("allows partial failure with policy_denied and validation_error", () => {
    const res: BatchResultResponse = {
      success_count: 1,
      error_count: 2,
      errors: ["id-2: Assignee required when entering state 'active'", "id-3: Transition from 'closed' to 'new' not allowed"],
      results: { "id-1": "ok", "id-2": "policy_denied", "id-3": "validation_error" },
    };
    expect(res.results?.["id-1"]).toBe("ok");
    expect(res.results?.["id-2"]).toBe("policy_denied");
    expect(res.results?.["id-3"]).toBe("validation_error");
  });

  it("allows conflict_error in results", () => {
    const res: BatchResultResponse = {
      success_count: 0,
      error_count: 1,
      errors: ["id-1: Artifact was modified by someone else."],
      results: { "id-1": "conflict_error" },
    };
    expect(res.results?.["id-1"]).toBe("conflict_error");
  });
});
