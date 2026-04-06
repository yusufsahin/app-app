import { describe, expect, it } from "vitest";
import { getValidTransitionsFromBundle } from "./workflowTransitions";

describe("getValidTransitionsFromBundle", () => {
  const bundle = {
    workflows: [
      {
        id: "w1",
        transitions: [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
        ],
      },
    ],
    artifact_types: [{ id: "t1", workflow_id: "w1" }],
  };

  it("returns target states for current state", () => {
    expect(getValidTransitionsFromBundle(bundle, "t1", "a")).toEqual(["b"]);
    expect(getValidTransitionsFromBundle(bundle, "t1", "b")).toEqual(["c"]);
  });

  it("returns empty when bundle or workflow missing", () => {
    expect(getValidTransitionsFromBundle(null, "t1", "a")).toEqual([]);
    expect(getValidTransitionsFromBundle({ workflows: [], artifact_types: [] }, "t1", "a")).toEqual([]);
  });
});
