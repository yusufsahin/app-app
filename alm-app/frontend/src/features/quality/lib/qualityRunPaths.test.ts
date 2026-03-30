import { describe, it, expect } from "vitest";
import {
  isArtifactUuid,
  qualityRunExecutePath,
  qualityRunExecuteAbsoluteUrl,
  qualityRunDetailsPath,
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

  it("builds execute path with test and step", () => {
    const run = "550e8400-e29b-41d4-a716-446655440000";
    const test = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    const step = "step-1";
    expect(
      qualityRunExecutePath("o", "p", run, {
        view: "execution",
        test,
        step,
      }),
    ).toBe(
      `/o/p/quality/runs?runExecute=${encodeURIComponent(run)}&runView=execution&runTest=${encodeURIComponent(test)}&runStep=${encodeURIComponent(step)}`,
    );
  });

  it("builds absolute execute URL", () => {
    expect(
      qualityRunExecuteAbsoluteUrl("https://app.example", "a", "b", "550e8400-e29b-41d4-a716-446655440000", {
        view: "execution",
      }),
    ).toBe(
      "https://app.example/a/b/quality/runs?runExecute=550e8400-e29b-41d4-a716-446655440000&runView=execution",
    );
  });

  it("strips trailing slash from origin", () => {
    expect(
      qualityRunExecuteAbsoluteUrl("https://app.example/", "a", "b", "550e8400-e29b-41d4-a716-446655440000"),
    ).toBe("https://app.example/a/b/quality/runs?runExecute=550e8400-e29b-41d4-a716-446655440000");
  });

  it("builds detail path", () => {
    const run = "550e8400-e29b-41d4-a716-446655440000";
    expect(qualityRunDetailsPath("o", "p", run)).toBe(
      `/o/p/quality/runs?runExecute=${encodeURIComponent(run)}&runView=overview`,
    );
  });
});
