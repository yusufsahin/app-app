/**
 * E1: Unit tests for artifact list params builder.
 */
import { describe, it, expect } from "vitest";
import { buildArtifactListParams } from "./artifactApi";

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
