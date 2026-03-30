import { describe, expect, it } from "vitest";
import { buildVelocityParams, buildBurndownParams } from "./orgApi";

describe("buildVelocityParams", () => {
  it("builds params with defaults", () => {
    const params = buildVelocityParams();
    expect(params.get("effort_field")).toBe("story_points");
    expect(params.get("last_n")).toBeNull();
  });

  it("includes release, cycles and last_n", () => {
    const params = buildVelocityParams({
      cycleNodeIds: ["c1", "c2"],
      releaseCycleNodeId: "r1",
      lastN: 8,
      effortField: "effort",
    });
    expect(params.getAll("cycle_node_id")).toEqual(["c1", "c2"]);
    expect(params.get("release_cycle_node_id")).toBe("r1");
    expect(params.get("last_n")).toBe("8");
    expect(params.get("effort_field")).toBe("effort");
  });

  it("includes last_n when zero", () => {
    const params = buildVelocityParams({ lastN: 0 });
    expect(params.get("last_n")).toBe("0");
  });

  it("omits empty releaseCycleNodeId", () => {
    const params = buildVelocityParams({ releaseCycleNodeId: "" });
    expect(params.get("release_cycle_node_id")).toBeNull();
  });
});

describe("buildBurndownParams", () => {
  it("uses default effort field", () => {
    const params = buildBurndownParams({ lastN: 4 });
    expect(params.get("last_n")).toBe("4");
    expect(params.get("effort_field")).toBe("story_points");
  });

  it("includes cycle ids in order", () => {
    const params = buildBurndownParams({ cycleNodeIds: ["x", "y"] });
    expect(params.getAll("cycle_node_id")).toEqual(["x", "y"]);
  });

  it("sets custom effort field and omits last_n when undefined", () => {
    const params = buildBurndownParams({ effortField: "hours" });
    expect(params.get("effort_field")).toBe("hours");
    expect(params.get("last_n")).toBeNull();
  });
});
