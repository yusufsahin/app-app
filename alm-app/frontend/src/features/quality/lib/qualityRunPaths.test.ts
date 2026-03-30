import { describe, it, expect } from "vitest";
import {
  isArtifactUuid,
  qualityRunExecutePath,
  qualityRunExecuteAbsoluteUrl,
  qualityRunWorkspaceDetailPath,
} from "./qualityRunPaths";

describe("qualityRunPaths", () => {
  it("detects UUID v4", () => {
    expect(isArtifactUuid("not-a-uuid")).toBe(false);
    expect(isArtifactUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("builds execute path without query (opens modal via runExecute)", () => {
    expect(qualityRunExecutePath("acme", "p1", "550e8400-e29b-41d4-a716-446655440000")).toBe(
      "/acme/p1/quality/runs?runExecute=550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("builds execute path with test and step (popout flag ignored in URL)", () => {
    const run = "550e8400-e29b-41d4-a716-446655440000";
    const test = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    const step = "step-1";
    expect(
      qualityRunExecutePath("o", "p", run, {
        popout: true,
        test,
        step,
      }),
    ).toBe(
      `/o/p/quality/runs?runExecute=${encodeURIComponent(run)}&runTest=${encodeURIComponent(test)}&runStep=${encodeURIComponent(step)}`,
    );
  });

  it("builds absolute execute URL", () => {
    expect(
      qualityRunExecuteAbsoluteUrl("https://app.example", "a", "b", "550e8400-e29b-41d4-a716-446655440000", {
        popout: true,
      }),
    ).toBe(
      "https://app.example/a/b/quality/runs?runExecute=550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("strips trailing slash from origin", () => {
    expect(
      qualityRunExecuteAbsoluteUrl("https://app.example/", "a", "b", "550e8400-e29b-41d4-a716-446655440000"),
    ).toBe("https://app.example/a/b/quality/runs?runExecute=550e8400-e29b-41d4-a716-446655440000");
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
