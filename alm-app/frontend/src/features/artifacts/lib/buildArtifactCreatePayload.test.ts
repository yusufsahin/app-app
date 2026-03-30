import { describe, expect, it } from "vitest";
import { buildArtifactCreatePayload } from "./buildArtifactCreatePayload";
import { TITLE_MAX_LENGTH } from "../utils";

describe("buildArtifactCreatePayload", () => {
  it("returns errors when title is empty", () => {
    const r = buildArtifactCreatePayload({
      title: "   ",
      artifact_type: "defect",
      description: "",
      parent_id: null,
      assignee_id: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toBeDefined();
    }
  });

  it("uses fallback artifact type when artifact_type is missing", () => {
    const r = buildArtifactCreatePayload(
      {
        title: "Bug",
        description: "",
        parent_id: "p1",
        assignee_id: null,
      },
      { fallbackArtifactType: "defect" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.artifact_type).toBe("defect");
  });

  it("splits custom fields from core keys", () => {
    const r = buildArtifactCreatePayload({
      title: "T",
      artifact_type: "defect",
      description: "d",
      parent_id: "root",
      assignee_id: "u1",
      severity: "high",
      noise_empty: "",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.custom_fields).toEqual({ severity: "high" });
      expect(r.payload.parent_id).toBe("root");
      expect(r.payload.assignee_id).toBe("u1");
    }
  });

  it("rejects title over max length", () => {
    const r = buildArtifactCreatePayload({
      title: "x".repeat(TITLE_MAX_LENGTH + 1),
      artifact_type: "defect",
      description: "",
      parent_id: null,
      assignee_id: null,
    });
    expect(r.ok).toBe(false);
  });
});
