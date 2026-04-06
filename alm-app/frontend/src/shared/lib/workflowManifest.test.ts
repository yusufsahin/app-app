/**
 * E1: Unit tests for workflow manifest helpers (Board columns).
 */
import { describe, it, expect } from "vitest";
import {
  buildWorkflowStateDisplayMap,
  dedupeStatesCaseInsensitive,
  getMergedWorkflowStatesForAllTypes,
  getMergedWorkflowStatesForArtifactTypes,
  getWorkflowStateLabelForArtifactType,
  getWorkflowStatesForType,
  isBoardSelectableArtifactType,
  normalizeWorkflowStateKey,
  resolveWorkflowStateForArtifactType,
  type ManifestBundleShape,
} from "./workflowManifest";

describe("getWorkflowStatesForType", () => {
  it("returns empty when bundle is null", () => {
    expect(getWorkflowStatesForType(null, null)).toEqual([]);
    expect(getWorkflowStatesForType(null, "story")).toEqual([]);
  });

  it("returns empty when bundle has no workflows", () => {
    expect(getWorkflowStatesForType({ workflows: [] }, null)).toEqual([]);
  });

  it("returns states from first workflow when no artifact type", () => {
    const bundle: ManifestBundleShape = {
      workflows: [{ id: "wf1", states: ["New", "Active", "Done"] }],
    };
    expect(getWorkflowStatesForType(bundle, null)).toEqual(["New", "Active", "Done"]);
  });

  it("returns states from first workflow when artifact type has no workflow_id", () => {
    const bundle: ManifestBundleShape = {
      workflows: [{ id: "wf1", states: ["A", "B"] }],
      artifact_types: [{ id: "story", name: "Story" }],
    };
    expect(getWorkflowStatesForType(bundle, "story")).toEqual(["A", "B"]);
  });

  it("returns states from workflow linked by artifact type", () => {
    const bundle: ManifestBundleShape = {
      workflows: [
        { id: "wf1", states: ["New", "Done"] },
        { id: "wf2", states: ["Todo", "In Progress", "Done"] },
      ],
      artifact_types: [
        { id: "story", name: "Story", workflow_id: "wf1" },
        { id: "task", name: "Task", workflow_id: "wf2" },
      ],
    };
    expect(getWorkflowStatesForType(bundle, "story")).toEqual(["New", "Done"]);
    expect(getWorkflowStatesForType(bundle, "task")).toEqual(["Todo", "In Progress", "Done"]);
  });

  it("normalizes state objects with id to string ids", () => {
    const bundle: ManifestBundleShape = {
      workflows: [{ id: "wf1", states: [{ id: "new" }, { id: "done" }] }],
    };
    expect(getWorkflowStatesForType(bundle, null)).toEqual(["new", "done"]);
  });

  it("de-duplicates states that only differ by case", () => {
    const bundle: ManifestBundleShape = {
      workflows: [{ id: "wf1", states: ["Active", "active", "Done"] }],
    };
    expect(getWorkflowStatesForType(bundle, null)).toEqual(["Active", "Done"]);
  });
});

describe("getMergedWorkflowStatesForAllTypes", () => {
  it("returns empty when bundle is null or has no workflows", () => {
    expect(getMergedWorkflowStatesForAllTypes(null)).toEqual([]);
    expect(getMergedWorkflowStatesForAllTypes({ workflows: [] })).toEqual([]);
  });

  it("uses first workflow when no artifact types", () => {
    const bundle: ManifestBundleShape = {
      workflows: [
        { id: "wf1", states: ["A", "B"] },
        { id: "wf2", states: ["X"] },
      ],
    };
    expect(getMergedWorkflowStatesForAllTypes(bundle)).toEqual(["A", "B"]);
  });

  it("merges referenced workflows in workflows array order with de-dupe", () => {
    const bundle: ManifestBundleShape = {
      workflows: [
        { id: "wf2", states: ["Todo", "Done"] },
        { id: "wf1", states: ["New", "Active", "Done"] },
      ],
      artifact_types: [
        { id: "story", workflow_id: "wf1" },
        { id: "bug", workflow_id: "wf2" },
      ],
    };
    expect(getMergedWorkflowStatesForAllTypes(bundle)).toEqual(["Todo", "Done", "New", "Active"]);
  });

  it("falls back to first workflow when types have no workflow_id", () => {
    const bundle: ManifestBundleShape = {
      workflows: [{ id: "wf1", states: ["S1", "S2"] }],
      artifact_types: [{ id: "x" }],
    };
    expect(getMergedWorkflowStatesForAllTypes(bundle)).toEqual(["S1", "S2"]);
  });

  it("de-duplicates case-insensitive state ids across merged workflows", () => {
    const bundle: ManifestBundleShape = {
      workflows: [
        { id: "wf1", states: ["New", "Active", "Done"] },
        { id: "wf2", states: ["new", "active", "resolved"] },
      ],
      artifact_types: [
        { id: "a", workflow_id: "wf1" },
        { id: "b", workflow_id: "wf2" },
      ],
    };
    expect(getMergedWorkflowStatesForAllTypes(bundle)).toEqual(["New", "Active", "Done", "resolved"]);
  });
});

describe("getMergedWorkflowStatesForArtifactTypes", () => {
  it("returns first workflow states when typeIds is empty", () => {
    const bundle: ManifestBundleShape = {
      workflows: [
        { id: "wf1", states: ["A", "B"] },
        { id: "wf2", states: ["X", "Y"] },
      ],
      artifact_types: [{ id: "story", workflow_id: "wf2" }],
    };
    expect(getMergedWorkflowStatesForArtifactTypes(bundle, [])).toEqual(["A", "B"]);
  });

  it("merges only workflows linked by the given type ids (excludes root-only workflows)", () => {
    const bundle: ManifestBundleShape = {
      workflows: [
        { id: "wfRoot", states: ["Folder", "Open"] },
        { id: "wfItem", states: ["Todo", "Done"] },
      ],
      artifact_types: [
        { id: "root-req", workflow_id: "wfRoot" },
        { id: "requirement", workflow_id: "wfItem" },
      ],
    };
    expect(getMergedWorkflowStatesForAllTypes(bundle)).toEqual(["Folder", "Open", "Todo", "Done"]);
    expect(getMergedWorkflowStatesForArtifactTypes(bundle, ["requirement"])).toEqual(["Todo", "Done"]);
  });
});

describe("isBoardSelectableArtifactType", () => {
  it("excludes root- ids and is_system_root types", () => {
    expect(isBoardSelectableArtifactType({ id: "root-req" })).toBe(false);
    expect(isBoardSelectableArtifactType({ id: "requirement" })).toBe(true);
    expect(isBoardSelectableArtifactType({ id: "folder", is_system_root: true })).toBe(false);
    expect(isBoardSelectableArtifactType({ id: "folder", is_system_root: false })).toBe(true);
  });
});

describe("dedupeStatesCaseInsensitive", () => {
  it("keeps first spelling and drops later case variants", () => {
    expect(dedupeStatesCaseInsensitive(["a", "A", "b"])).toEqual(["a", "b"]);
  });
});

describe("normalizeWorkflowStateKey", () => {
  it("treats empty and whitespace as one bucket", () => {
    expect(normalizeWorkflowStateKey("")).toBe(normalizeWorkflowStateKey("  "));
  });
});

describe("resolveWorkflowStateForArtifactType", () => {
  const bundle: ManifestBundleShape = {
    workflows: [
      { id: "wf1", states: ["new", "active", "done"] },
      { id: "wf2", states: ["New", "Active"] },
    ],
    artifact_types: [
      { id: "defect", workflow_id: "wf1" },
      { id: "story", workflow_id: "wf2" },
    ],
  };

  it("returns exact state id for column label with different casing", () => {
    expect(resolveWorkflowStateForArtifactType(bundle, "defect", "Active")).toBe("active");
    expect(resolveWorkflowStateForArtifactType(bundle, "story", "active")).toBe("Active");
  });

  it("returns null when type has no matching state", () => {
    expect(resolveWorkflowStateForArtifactType(bundle, "defect", "missing")).toBeNull();
  });
});

describe("buildWorkflowStateDisplayMap", () => {
  it("returns empty map for null or no workflows", () => {
    expect(buildWorkflowStateDisplayMap(null).size).toBe(0);
    expect(buildWorkflowStateDisplayMap({ workflows: [] }).size).toBe(0);
  });

  it("maps string states to themselves as labels", () => {
    const bundle: ManifestBundleShape = {
      workflows: [{ id: "w1", states: ["new", "done"] }],
    };
    const m = buildWorkflowStateDisplayMap(bundle);
    expect(m.get("new")).toBe("new");
    expect(m.get("done")).toBe("done");
  });

  it("uses name when state is an object", () => {
    const bundle: ManifestBundleShape = {
      workflows: [
        {
          id: "w1",
          states: [
            { id: "new", name: "New" },
            { id: "active", name: "Active" },
          ],
        },
      ],
    };
    const m = buildWorkflowStateDisplayMap(bundle);
    expect(m.get("new")).toBe("New");
    expect(m.get("active")).toBe("Active");
  });

  it("first workflow wins when same state id appears twice", () => {
    const bundle: ManifestBundleShape = {
      workflows: [
        { id: "w1", states: [{ id: "x", name: "First" }] },
        { id: "w2", states: [{ id: "x", name: "Second" }] },
      ],
    };
    expect(buildWorkflowStateDisplayMap(bundle).get("x")).toBe("First");
  });

  it("mixes string and object states", () => {
    const bundle: ManifestBundleShape = {
      workflows: [{ id: "w1", states: ["raw", { id: "obj", name: "Object label" }] }],
    };
    const m = buildWorkflowStateDisplayMap(bundle);
    expect(m.get("raw")).toBe("raw");
    expect(m.get("obj")).toBe("Object label");
  });
});

describe("getWorkflowStateLabelForArtifactType", () => {
  const bundle: ManifestBundleShape = {
    workflows: [
      {
        id: "wf-defect",
        states: [
          { id: "open", name: "Open (defect)" },
          { id: "closed", name: "Closed (defect)" },
        ],
      },
      {
        id: "wf-quality",
        states: [
          { id: "open", name: "Open (quality)" },
          { id: "verified", name: "Verified" },
        ],
      },
    ],
    artifact_types: [
      { id: "defect", workflow_id: "wf-defect" },
      { id: "quality_finding", workflow_id: "wf-quality" },
    ],
  };

  it("returns empty string for empty state id", () => {
    expect(getWorkflowStateLabelForArtifactType(bundle, "defect", "")).toBe("");
    expect(getWorkflowStateLabelForArtifactType(bundle, "defect", null)).toBe("");
  });

  it("uses the workflow for the artifact type so same id can have different labels", () => {
    expect(getWorkflowStateLabelForArtifactType(bundle, "defect", "open")).toBe("Open (defect)");
    expect(getWorkflowStateLabelForArtifactType(bundle, "quality_finding", "open")).toBe("Open (quality)");
  });

  it("matches state id case-insensitively within the type workflow", () => {
    expect(getWorkflowStateLabelForArtifactType(bundle, "defect", "OPEN")).toBe("Open (defect)");
  });

  it("falls back to display map when id is missing from type workflow but exists elsewhere", () => {
    expect(getWorkflowStateLabelForArtifactType(bundle, "defect", "verified")).toBe("Verified");
  });
});
