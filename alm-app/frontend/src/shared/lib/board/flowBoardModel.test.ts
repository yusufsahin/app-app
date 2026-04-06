import { describe, expect, it } from "vitest";
import {
  buildFlowBoardColumnModel,
  canDropOnFlowColumn,
  getDefaultBoardSurface,
  groupArtifactsByFlowColumns,
  resolveFlowBoardDropTargetState,
} from "./flowBoardModel";
import type { FlowBoardArtifact, ManifestBundleWithBoard } from "./types";

const basicBundle: ManifestBundleWithBoard = {
  workflows: [
    {
      id: "w1",
      states: [
        { id: "new", name: "New", category: "proposed" },
        { id: "active", name: "Active", category: "in_progress" },
        { id: "done", name: "Done", category: "completed" },
      ],
      transitions: [
        { from: "new", to: "active" },
        { from: "active", to: "done" },
      ],
    },
  ],
  artifact_types: [{ id: "requirement", name: "Requirement", workflow_id: "w1" }],
};

function art(overrides: Partial<FlowBoardArtifact> & Pick<FlowBoardArtifact, "id" | "state">): FlowBoardArtifact {
  return {
    artifact_type: "requirement",
    allowed_actions: ["transition"],
    ...overrides,
  };
}

describe("buildFlowBoardColumnModel", () => {
  it("adds alphabetically sorted extra columns for states not in workflow", () => {
    const artifacts = [art({ id: "1", state: "weird" }), art({ id: "2", state: "zebra" })];
    const model = buildFlowBoardColumnModel(basicBundle, "requirement", [], artifacts, null);
    expect(model.columns.map((c) => c.key)).toEqual(["new", "active", "done", "weird", "zebra"]);
    expect(model.columns.every((c) => c.dropKind === "state")).toBe(true);
  });

  it("does not add a second column when artifact state differs only by case from workflow state", () => {
    const artifacts = [art({ id: "1", state: "NEW" })];
    const model = buildFlowBoardColumnModel(basicBundle, "requirement", [], artifacts, null);
    expect(model.columns.map((c) => c.key)).toEqual(["new", "active", "done"]);
  });

  it("applies hide_state_ids and column_order_override for workflow_states source", () => {
    const surface = {
      hide_state_ids: ["done"],
      column_order_override: ["active", "new"],
    };
    const model = buildFlowBoardColumnModel(basicBundle, "requirement", [], [], surface);
    expect(model.columns.map((c) => c.key)).toEqual(["active", "new"]);
  });

  it("builds category columns when column_source is state_category", () => {
    const surface = { column_source: "state_category" as const };
    const artifacts = [art({ id: "1", state: "new" }), art({ id: "2", state: "active" })];
    const model = buildFlowBoardColumnModel(basicBundle, "requirement", [], artifacts, surface);
    const keys = model.columns.map((c) => c.key);
    expect(keys.slice(0, 3)).toEqual(["proposed", "in_progress", "completed"]);
    expect(model.columns[0]?.dropKind).toBe("category");
  });
});

describe("groupArtifactsByFlowColumns", () => {
  it("groups by canonical state column", () => {
    const model = buildFlowBoardColumnModel(basicBundle, "requirement", [], [], null);
    const artifacts = [art({ id: "1", state: "new" }), art({ id: "2", state: "active" })];
    const map = groupArtifactsByFlowColumns(basicBundle, model, artifacts);
    expect(map.get("new")?.map((a) => a.id)).toEqual(["1"]);
    expect(map.get("active")?.map((a) => a.id)).toEqual(["2"]);
  });
});

describe("canDropOnFlowColumn", () => {
  const tb = basicBundle;

  it("returns false without transition allowed_action", () => {
    const model = buildFlowBoardColumnModel(basicBundle, "requirement", [], [], null);
    const a = art({ id: "1", state: "new", allowed_actions: [] });
    expect(canDropOnFlowColumn(basicBundle, tb, a, "active", model)).toBe(false);
  });

  it("returns true for allowed transition", () => {
    const model = buildFlowBoardColumnModel(basicBundle, "requirement", [], [], null);
    const a = art({ id: "1", state: "new" });
    expect(canDropOnFlowColumn(basicBundle, tb, a, "active", model)).toBe(true);
  });

  it("returns false for disallowed transition", () => {
    const model = buildFlowBoardColumnModel(basicBundle, "requirement", [], [], null);
    const a = art({ id: "1", state: "new" });
    expect(canDropOnFlowColumn(basicBundle, tb, a, "done", model)).toBe(false);
  });
});

describe("resolveFlowBoardDropTargetState", () => {
  it("resolves category column to first state in that category", () => {
    const col = { key: "in_progress", dropKind: "category" as const };
    expect(resolveFlowBoardDropTargetState(basicBundle, "requirement", col)).toBe("active");
  });

  it("resolves state column via workflow spelling", () => {
    const col = { key: "active", dropKind: "state" as const };
    expect(resolveFlowBoardDropTargetState(basicBundle, "requirement", col)).toBe("active");
  });
});

describe("getDefaultBoardSurface", () => {
  it("returns null when board section missing", () => {
    expect(getDefaultBoardSurface(basicBundle)).toBeNull();
  });

  it("reads board.surfaces.default", () => {
    const b: ManifestBundleWithBoard = {
      ...basicBundle,
      board: { surfaces: { default: { column_source: "state_category" } } },
    };
    expect(getDefaultBoardSurface(b)?.column_source).toBe("state_category");
  });
});
