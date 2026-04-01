/**
 * E1: Unit tests for artifact list params builder and batch transition response shape.
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  buildArtifactListParams,
  downloadArtifactImportTemplate,
  exportArtifactsFile,
  fetchAllArtifactsPages,
  importArtifactsFile,
  type BatchResultResponse,
} from "./artifactApi";
import { apiClient } from "./client";

function mkArtifact(id: string) {
  return {
    id,
    project_id: "p1",
    artifact_type: "task",
    title: `T-${id}`,
    description: "",
    state: "new",
    assignee_id: null,
    parent_id: null,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("maps cycle filter and area filter params", () => {
    expect(
      buildArtifactListParams({ cycleId: "c1", areaNodeId: "a1" }),
    ).toEqual({ cycle_id: "c1", area_node_id: "a1" });
  });

  it("omits empty cycle and area filters", () => {
    expect(
      buildArtifactListParams({ cycleId: null, areaNodeId: undefined }),
    ).toEqual({});
  });

  it("prefers release filter over cycle filter when both are set", () => {
    expect(
      buildArtifactListParams({ releaseId: "r1", cycleId: "c1", areaNodeId: "a1" }),
    ).toEqual({ release_id: "r1", area_node_id: "a1" });
  });

  it("includes tree for any non-empty slug (manifest-driven tree_roots)", () => {
    expect(buildArtifactListParams({ tree: "requirement" })).toEqual({ tree: "requirement" });
    expect(buildArtifactListParams({ tree: "quality" })).toEqual({ tree: "quality" });
    expect(buildArtifactListParams({ tree: "defect" })).toEqual({ tree: "defect" });
    expect(buildArtifactListParams({ tree: "" })).toEqual({});
    expect(buildArtifactListParams({ tree: "  " })).toEqual({});
    expect(buildArtifactListParams({ tree: "custom_tree" })).toEqual({ tree: "custom_tree" });
  });

  it("sets include_system_roots when includeSystemRoots is true", () => {
    expect(buildArtifactListParams({ includeSystemRoots: true })).toEqual({
      include_system_roots: true,
    });
    expect(buildArtifactListParams({ includeSystemRoots: false })).toEqual({});
  });

  it("maps parent_id when parentId is non-empty", () => {
    expect(buildArtifactListParams({ parentId: "  " })).toEqual({});
    expect(buildArtifactListParams({ parentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" })).toEqual({
      parent_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
  });

  it("maps team_id when teamId is non-empty", () => {
    expect(buildArtifactListParams({ teamId: "  team-123  " })).toEqual({
      team_id: "team-123",
    });
  });

  it("combines parent_id with tree and include_system_roots", () => {
    expect(
      buildArtifactListParams({
        tree: "quality",
        includeSystemRoots: true,
        parentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      }),
    ).toEqual({
      tree: "quality",
      include_system_roots: true,
      parent_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
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
        cycleId: "cycle-1",
      }),
    ).toEqual({
      state: "new",
      type: "story",
      sort_by: "created_at",
      sort_order: "asc",
      q: "bug",
      limit: 10,
      offset: 0,
      cycle_id: "cycle-1",
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

describe("fetchAllArtifactsPages", () => {
  it("stops when page returns fewer than page size", async () => {
    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValueOnce({
        data: {
          items: [mkArtifact("1"), mkArtifact("2")],
          total: 2,
          allowed_actions: ["read"],
        },
      } as never);

    const out = await fetchAllArtifactsPages("o1", "p1", { state: "new" }, 3);

    expect(out.total).toBe(2);
    expect(out.items).toHaveLength(2);
    expect(out.allowed_actions).toEqual(["read"]);
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy.mock.calls[0]?.[1]).toMatchObject({
      params: { state: "new", limit: 3, offset: 0 },
    });
  });

  it("continues paging until collected items reach total", async () => {
    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValueOnce({
        data: {
          items: [mkArtifact("1"), mkArtifact("2")],
          total: 3,
          allowed_actions: ["read"],
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          items: [mkArtifact("3"), mkArtifact("4")],
          total: 3,
          allowed_actions: ["update"],
        },
      } as never);

    const out = await fetchAllArtifactsPages("o1", "p1", { type: "task" }, 2);

    expect(out.total).toBe(3);
    expect(out.items.map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
    expect(out.allowed_actions).toEqual(["read"]);
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(getSpy.mock.calls[1]?.[1]).toMatchObject({
      params: { type: "task", limit: 2, offset: 2 },
    });
  });

  it("stops when API returns empty page", async () => {
    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValueOnce({
        data: {
          items: [mkArtifact("1"), mkArtifact("2")],
          total: 10,
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          items: [],
          total: 10,
        },
      } as never);

    const out = await fetchAllArtifactsPages("o1", "p1", {}, 2);

    expect(out.items).toHaveLength(2);
    expect(out.total).toBe(10);
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});

describe("artifact import/export helpers", () => {
  it("downloads exported files using the response filename", async () => {
    const click = vi.fn();
    const createElementSpy = vi.fn(() => ({ click }));
    vi.stubGlobal("document", { createElement: createElementSpy });
    const objectUrlSpy = vi.fn(() => "blob:download");
    const revokeSpy = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: objectUrlSpy, revokeObjectURL: revokeSpy });
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: new Blob(["ok"], { type: "text/csv" }),
      headers: { "content-disposition": 'attachment; filename="artifact-export.csv"' },
    } as never);

    await exportArtifactsFile("org-1", "proj-1", { format: "csv", scope: "generic" });

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(click).toHaveBeenCalled();
    expect(objectUrlSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith("blob:download");
  });

  it("downloads import templates", async () => {
    const click = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => ({ click })) });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:template"), revokeObjectURL: vi.fn() });
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: new Blob(["ok"], { type: "application/zip" }),
      headers: { "content-disposition": 'attachment; filename="artifact-template.zip"' },
    } as never);

    await downloadArtifactImportTemplate("org-1", "proj-1", { format: "csv", scope: "testcases" });

    expect(click).toHaveBeenCalled();
  });

  it("uploads import files with multipart form data", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        created_count: 1,
        updated_count: 0,
        validated_count: 0,
        skipped_count: 0,
        failed_count: 0,
        rows: [{ row_number: 2, sheet: "artifacts", artifact_key: "PROJ-1", status: "created" }],
      },
    } as never);

    const file = new File(["artifact_key,title\nPROJ-1,Imported"], "artifacts.csv", { type: "text/csv" });
    const out = await importArtifactsFile("org-1", "proj-1", {
      file,
      scope: "generic",
      mode: "upsert",
      validateOnly: true,
    });

    expect(out.created_count).toBe(1);
    expect(postSpy).toHaveBeenCalledTimes(1);
    const config = postSpy.mock.calls[0]?.[2];
    expect(config).toMatchObject({
      params: { scope: "generic", mode: "upsert", validate_only: true },
      headers: { "Content-Type": "multipart/form-data" },
    });
  });
});
