import { describe, it, expect } from "vitest";
import { registryDefaultParams } from "./registryDefaultParams";

describe("registryDefaultParams", () => {
  it("returns empty for non-object schema", () => {
    expect(registryDefaultParams(null, {})).toEqual({});
    expect(registryDefaultParams(123, {})).toEqual({});
    expect(registryDefaultParams({ type: "string" }, {})).toEqual({});
  });

  it("copies defaults from schema properties", () => {
    const params = registryDefaultParams(
      {
        type: "object",
        properties: {
          last_n: { type: "integer", default: 6 },
          effort_field: { type: "string", default: "story_points" },
        },
      },
      {},
    );
    expect(params).toEqual({ last_n: 6, effort_field: "story_points" });
  });

  it("fills project_id when relevant", () => {
    const pid = "00000000-0000-0000-0000-000000000000";
    expect(
      registryDefaultParams(
        {
          type: "object",
          required: ["project_id"],
          properties: { project_id: { type: "string" } },
        },
        { projectId: pid },
      ),
    ).toEqual({ project_id: pid });
  });
});

