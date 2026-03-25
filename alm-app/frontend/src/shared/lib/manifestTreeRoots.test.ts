/**
 * Unit tests for manifest tree root resolution (Quality / Requirements / Defects slugs).
 */
import { describe, it, expect } from "vitest";
import { getDeclaredTreeRootsFromManifestBundle, getTreeRootsFromManifestBundle } from "./manifestTreeRoots";

describe("getTreeRootsFromManifestBundle", () => {
  it("returns default three roots when bundle is null/undefined", () => {
    expect(getTreeRootsFromManifestBundle(undefined)).toHaveLength(3);
    expect(getTreeRootsFromManifestBundle(null)).toHaveLength(3);
    expect(getTreeRootsFromManifestBundle({})).toHaveLength(3);
  });

  it("default roots include quality tree_id", () => {
    const roots = getTreeRootsFromManifestBundle(undefined);
    const q = roots.find((r) => r.tree_id === "quality");
    expect(q).toEqual({
      tree_id: "quality",
      root_artifact_type: "root-quality",
      label: "Quality",
    });
  });

  it("returns defaults when tree_roots is empty array", () => {
    expect(getTreeRootsFromManifestBundle({ tree_roots: [] })).toHaveLength(3);
  });

  it("parses manifest tree_roots with tree_id and root_artifact_type", () => {
    const roots = getTreeRootsFromManifestBundle({
      tree_roots: [
        { tree_id: "req", root_artifact_type: "root-requirement", label: "Reqs" },
        { tree_id: "quality", root_artifact_type: "root-quality", name: "QA" },
      ],
    });
    expect(roots).toHaveLength(2);
    expect(roots[0]).toMatchObject({ tree_id: "req", label: "Reqs" });
    expect(roots[1]).toMatchObject({ tree_id: "quality", label: "QA" });
  });

  it("accepts id alias for tree_id and root_type alias for root_artifact_type", () => {
    const roots = getTreeRootsFromManifestBundle({
      tree_roots: [{ id: "q", root_type: "root-quality", label: "Q" }],
    });
    expect(roots).toEqual([{ tree_id: "q", root_artifact_type: "root-quality", label: "Q" }]);
  });

  it("skips invalid entries and falls back to defaults when all skipped", () => {
    expect(
      getTreeRootsFromManifestBundle({
        tree_roots: [{}, { tree_id: "", root_artifact_type: "x" }, null as unknown as object],
      }),
    ).toHaveLength(3);
  });

  it("derives title-case label from tree_id when label and name missing", () => {
    const roots = getTreeRootsFromManifestBundle({
      tree_roots: [{ tree_id: "my-custom-tree", root_artifact_type: "root-x" }],
    });
    expect(roots).toHaveLength(1);
    expect(roots[0]?.label).toBe("My Custom Tree");
  });

  it("declared roots helper returns empty when no tree_roots", () => {
    expect(getDeclaredTreeRootsFromManifestBundle(undefined)).toEqual([]);
    expect(getDeclaredTreeRootsFromManifestBundle({})).toEqual([]);
  });

  it("declared roots helper parses configured roots without defaults", () => {
    const roots = getDeclaredTreeRootsFromManifestBundle({
      tree_roots: [{ tree_id: "quality", root_artifact_type: "root-quality", label: "Quality" }],
    });
    expect(roots).toEqual([
      { tree_id: "quality", root_artifact_type: "root-quality", label: "Quality" },
    ]);
  });
});
