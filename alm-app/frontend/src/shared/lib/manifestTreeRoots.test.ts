/**
 * Unit tests for manifest tree root resolution (Quality / TestSuites / Requirements / Defects slugs).
 */
import { describe, it, expect } from "vitest";
import { getDeclaredTreeRootsFromManifestBundle, getTreeRootsFromManifestBundle } from "./manifestTreeRoots";

describe("getTreeRootsFromManifestBundle", () => {
  it("returns default four roots when bundle is null/undefined", () => {
    expect(getTreeRootsFromManifestBundle(undefined)).toHaveLength(4);
    expect(getTreeRootsFromManifestBundle(null)).toHaveLength(4);
    expect(getTreeRootsFromManifestBundle({})).toHaveLength(4);
  });

  it("default roots include quality and testsuites tree ids", () => {
    const roots = getTreeRootsFromManifestBundle(undefined);
    const quality = roots.find((r) => r.tree_id === "quality");
    const suites = roots.find((r) => r.tree_id === "testsuites");
    expect(quality).toEqual({
      tree_id: "quality",
      root_artifact_type: "root-quality",
      label: "Quality",
    });
    expect(suites).toEqual({
      tree_id: "testsuites",
      root_artifact_type: "root-testsuites",
      label: "Test suites",
    });
  });

  it("returns defaults when tree_roots is empty array", () => {
    expect(getTreeRootsFromManifestBundle({ tree_roots: [] })).toHaveLength(4);
  });

  it("parses manifest tree_roots with tree_id and root_artifact_type", () => {
    const roots = getTreeRootsFromManifestBundle({
      tree_roots: [
        { tree_id: "req", root_artifact_type: "root-requirement", label: "Reqs" },
        { tree_id: "quality", root_artifact_type: "root-quality", name: "Quality" },
      ],
    });
    expect(roots).toHaveLength(2);
    expect(roots[0]).toMatchObject({ tree_id: "req", label: "Reqs" });
    expect(roots[1]).toMatchObject({ tree_id: "quality", label: "Quality" });
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
    ).toHaveLength(4);
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
