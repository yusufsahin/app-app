import { describe, it, expect } from "vitest";
import {
  isArtifactUuid,
  qualityRunExecutePath,
  qualityRunWorkspaceDetailPath,
} from "./qualityRunPaths";

describe("qualityRunPaths", () => {
  it("detects UUID v4", () => {
    expect(isArtifactUuid("not-a-uuid")).toBe(false);
    expect(isArtifactUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("builds execute path", () => {
    expect(qualityRunExecutePath("acme", "p1", "550e8400-e29b-41d4-a716-446655440000")).toBe(
      "/acme/p1/quality/runs/550e8400-e29b-41d4-a716-446655440000/execute",
    );
  });

  it("builds detail path with or without parent", () => {
    const run = "550e8400-e29b-41d4-a716-446655440000";
    const parent = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    expect(qualityRunWorkspaceDetailPath("o", "p", run, parent)).toBe(
      `/o/p/quality/runs?under=${encodeURIComponent(parent)}&artifact=${encodeURIComponent(run)}`,
    );
    expect(qualityRunWorkspaceDetailPath("o", "p", run, null)).toBe(`/o/p/quality/runs?artifact=${encodeURIComponent(run)}`);
    expect(qualityRunWorkspaceDetailPath("o", "p", run, "bad")).toBe(`/o/p/quality/runs?artifact=${encodeURIComponent(run)}`);
  });
});
