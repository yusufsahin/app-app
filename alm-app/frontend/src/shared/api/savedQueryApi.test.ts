/**
 * E1: Unit tests for saved query filter helpers (list state ↔ filter_params).
 */
import { describe, it, expect } from "vitest";
import {
  listStateToFilterParams,
  filterParamsToListStatePatch,
} from "./savedQueryApi";

describe("listStateToFilterParams", () => {
  it("returns empty object for empty state", () => {
    expect(listStateToFilterParams({})).toEqual({});
  });

  it("maps state filter to state", () => {
    expect(listStateToFilterParams({ stateFilter: "active" })).toEqual({
      state: "active",
    });
  });

  it("maps type, cycle, area, sort, and search", () => {
    expect(
      listStateToFilterParams({
        stateFilter: "new",
        typeFilter: "requirement",
        releaseFilter: "release-id",
        cycleFilter: "cycle-id",
        areaNodeFilter: "area-id",
        sortBy: "updated_at",
        sortOrder: "asc",
        searchQuery: "foo",
      }),
    ).toEqual({
      state: "new",
      type: "requirement",
      release_id: "release-id",
      cycle_id: "cycle-id",
      area_node_id: "area-id",
      sort_by: "updated_at",
      sort_order: "asc",
      q: "foo",
    });
  });

  it("omits empty search query", () => {
    expect(listStateToFilterParams({ searchQuery: "  " })).toEqual({});
  });
});

describe("filterParamsToListStatePatch", () => {
  it("returns only page: 0 for null/undefined", () => {
    expect(filterParamsToListStatePatch(null)).toEqual({ page: 0 });
    expect(filterParamsToListStatePatch(undefined)).toEqual({ page: 0 });
  });

  it("returns page: 0 for non-object", () => {
    expect(filterParamsToListStatePatch("x" as unknown as Record<string, unknown>)).toEqual({ page: 0 });
  });

  it("maps filter_params to list state patch", () => {
    expect(
      filterParamsToListStatePatch({
        state: "active",
        type: "task",
        q: "search",
        release_id: "r1",
        cycle_id: "c1",
        area_node_id: "a1",
        sort_by: "title",
        sort_order: "asc",
      }),
    ).toEqual({
      stateFilter: "active",
      typeFilter: "task",
      treeFilter: "",
      searchQuery: "search",
      searchInput: "search",
      releaseFilter: "r1",
      cycleFilter: "c1",
      areaNodeFilter: "a1",
      tagFilter: "",
      sortBy: "title",
      sortOrder: "asc",
      page: 0,
    });
  });

  it("defaults sort_by to created_at and sort_order to desc", () => {
    expect(filterParamsToListStatePatch({})).toEqual({
      stateFilter: "",
      typeFilter: "",
      treeFilter: "",
      searchQuery: "",
      searchInput: "",
      releaseFilter: "",
      cycleFilter: "",
      areaNodeFilter: "",
      tagFilter: "",
      sortBy: "created_at",
      sortOrder: "desc",
      page: 0,
    });
  });
});
