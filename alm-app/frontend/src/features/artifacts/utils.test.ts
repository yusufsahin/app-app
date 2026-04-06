import { describe, it, expect } from "vitest";
import {
  collectManifestReachableTypeIds,
  filterListSchemaForBacklog,
  getManifestChildTypeIdsForParent,
  getSystemRootArtifactTypes,
  getToolbarCreatableArtifactTypeIds,
  isManifestFieldExcludedFromForms,
  manifestArtifactTypeAllowsChildren,
} from "./utils";

describe("isManifestFieldExcludedFromForms", () => {
  it("returns false for non-objects", () => {
    expect(isManifestFieldExcludedFromForms(null)).toBe(false);
    expect(isManifestFieldExcludedFromForms(undefined)).toBe(false);
    expect(isManifestFieldExcludedFromForms("x")).toBe(false);
  });

  it("respects snake_case flag", () => {
    expect(isManifestFieldExcludedFromForms({ id: "x", exclude_from_form_schema: true })).toBe(true);
    expect(isManifestFieldExcludedFromForms({ id: "x", exclude_from_form_schema: false })).toBe(false);
  });

  it("respects camelCase flag", () => {
    expect(isManifestFieldExcludedFromForms({ id: "x", excludeFromFormSchema: true })).toBe(true);
  });
});

describe("getManifestChildTypeIdsForParent / manifestArtifactTypeAllowsChildren", () => {
  it("reads child_types from flattened artifact_types", () => {
    const bundle = {
      artifact_types: [
        { id: "epic", child_types: ["feature", "workitem"] },
        { id: "workitem", child_types: [] },
      ],
    };
    expect(getManifestChildTypeIdsForParent(bundle, "epic")).toEqual(["feature", "workitem"]);
    expect(manifestArtifactTypeAllowsChildren(bundle, "epic")).toBe(true);
    expect(getManifestChildTypeIdsForParent(bundle, "workitem")).toEqual([]);
    expect(manifestArtifactTypeAllowsChildren(bundle, "workitem")).toBe(false);
  });

  it("falls back to defs when flat entry missing or empty child_types", () => {
    const bundle = {
      artifact_types: [{ id: "epic" }],
      defs: [
        { kind: "ArtifactType", id: "epic", child_types: ["feature"] },
        { kind: "Workflow", id: "basic" },
      ],
    };
    expect(getManifestChildTypeIdsForParent(bundle, "epic")).toEqual(["feature"]);
    expect(manifestArtifactTypeAllowsChildren(bundle, "epic")).toBe(true);
  });

  it("returns no child types when manifest sets allow_create_children false", () => {
    const bundle = {
      artifact_types: [{ id: "epic", child_types: ["feature"], allow_create_children: false }],
      defs: [],
    };
    expect(getManifestChildTypeIdsForParent(bundle, "epic")).toEqual([]);
    expect(manifestArtifactTypeAllowsChildren(bundle, "epic")).toBe(false);
  });

  it("respects allow_create_children false on defs ArtifactType", () => {
    const bundle = {
      artifact_types: [],
      defs: [{ kind: "ArtifactType", id: "epic", child_types: ["feature"], allow_create_children: false }],
    };
    expect(getManifestChildTypeIdsForParent(bundle, "epic")).toEqual([]);
  });

  it("respects flags.allow_create_children false on flat artifact_types", () => {
    const bundle = {
      artifact_types: [{ id: "epic", child_types: ["feature"], flags: { allow_create_children: false } }],
      defs: [],
    };
    expect(getManifestChildTypeIdsForParent(bundle, "epic")).toEqual([]);
  });

  it("uses explicit system_roots from bundle when present", () => {
    const bundle = {
      system_roots: ["root-custom"],
      artifact_types: [{ id: "root-custom", child_types: ["a"] }],
      defs: [],
    };
    const roots = getSystemRootArtifactTypes(bundle);
    expect(roots.has("root-custom")).toBe(true);
    expect(roots.has("root-requirement")).toBe(false);
  });
});

describe("getToolbarCreatableArtifactTypeIds", () => {
  it("excludes system roots and lists only descendants under the module root", () => {
    const bundle = {
      artifact_types: [
        { id: "root-requirement", name: "Root" },
        { id: "epic", name: "Epic" },
        { id: "campaign-type", name: "Campaign" },
      ],
      defs: [
        { kind: "ArtifactType", id: "root-requirement", child_types: ["epic"] },
        { kind: "ArtifactType", id: "root-quality", child_types: ["campaign-type"] },
        { kind: "ArtifactType", id: "epic", child_types: [] },
      ],
    };
    const roots = getSystemRootArtifactTypes(bundle);
    const ids = getToolbarCreatableArtifactTypeIds(bundle, "root-requirement", roots);
    expect(ids).toEqual(["epic"]);
    expect(ids.some((x) => x.startsWith("root-"))).toBe(false);
  });

  it("returns empty when module root does not match tree", () => {
    const bundle = {
      artifact_types: [{ id: "epic" }],
      defs: [{ kind: "ArtifactType", id: "root-requirement", child_types: ["epic"] }],
    };
    const roots = getSystemRootArtifactTypes(bundle);
    expect(getToolbarCreatableArtifactTypeIds(bundle, "", roots)).toEqual([]);
  });

  it("BFS includes nested descendants for toolbar ordering", () => {
    const bundle = {
      artifact_types: [
        { id: "story", name: "Story" },
        { id: "epic", name: "Epic" },
        { id: "task", name: "Task" },
      ],
      defs: [
        { kind: "ArtifactType", id: "root-requirement", child_types: ["epic"] },
        { kind: "ArtifactType", id: "epic", child_types: ["story"] },
        { kind: "ArtifactType", id: "story", child_types: ["task"] },
        { kind: "ArtifactType", id: "task", child_types: [] },
      ],
    };
    const roots = getSystemRootArtifactTypes(bundle);
    const ids = getToolbarCreatableArtifactTypeIds(bundle, "root-requirement", roots);
    // Ordered by manifest flat artifact_types listing, then any leftover creatable ids.
    expect(ids).toEqual(["story", "epic", "task"]);
    const reachable = collectManifestReachableTypeIds(bundle, "root-requirement");
    expect(reachable.has("task")).toBe(true);
  });

  it("does not leak other module types into requirement toolbar set", () => {
    const bundle = {
      artifact_types: [
        { id: "workitem" },
        { id: "test-case" },
        { id: "defect" },
      ],
      defs: [
        { kind: "ArtifactType", id: "root-requirement", child_types: ["workitem"] },
        { kind: "ArtifactType", id: "root-quality", child_types: ["test-case"] },
        { kind: "ArtifactType", id: "root-defect", child_types: ["defect"] },
        { kind: "ArtifactType", id: "workitem", child_types: [] },
        { kind: "ArtifactType", id: "test-case", child_types: [] },
        { kind: "ArtifactType", id: "defect", child_types: [] },
      ],
    };
    const roots = getSystemRootArtifactTypes(bundle);
    expect(getToolbarCreatableArtifactTypeIds(bundle, "root-requirement", roots)).toEqual(["workitem"]);
  });
});

describe("filterListSchemaForBacklog", () => {
  it("keeps only backlog-visible columns", () => {
    const result = filterListSchemaForBacklog({
      entity_type: "artifact",
      columns: [
        { key: "artifact_key", label: "Key", order: 1 },
        { key: "title", label: "Title", order: 2 },
        { key: "severity", label: "Severity", order: 3 },
        { key: "assignee_id", label: "Assignee", order: 4 },
        { key: "updated_at", label: "Updated", order: 5 },
      ],
    });

    expect(result?.columns.map((column) => column.key)).toEqual([
      "artifact_key",
      "title",
      "assignee_id",
      "updated_at",
    ]);
  });

  it("preserves nullish inputs", () => {
    expect(filterListSchemaForBacklog(null)).toBeNull();
    expect(filterListSchemaForBacklog(undefined)).toBeUndefined();
  });
});
