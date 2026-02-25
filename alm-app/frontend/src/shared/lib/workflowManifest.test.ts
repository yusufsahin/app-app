/**
 * E1: Unit tests for workflow manifest helpers (Board columns).
 */
import { describe, it, expect } from "vitest";
import { getWorkflowStatesForType, type ManifestBundleShape } from "./workflowManifest";

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
});
