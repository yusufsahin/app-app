/**
 * Traceability summary API: query key stability for React Query cache.
 */
import { describe, it, expect } from "vitest";
import { traceabilitySummaryQueryKey } from "./traceabilityApi";

describe("traceabilitySummaryQueryKey", () => {
  it("returns a tuple including org, project, artifact and literal segment", () => {
    expect(traceabilitySummaryQueryKey("acme", "proj-1", "art-9")).toEqual([
      "orgs",
      "acme",
      "projects",
      "proj-1",
      "artifacts",
      "art-9",
      "traceability-summary",
    ]);
  });

  it("treats missing slug or ids as undefined segments", () => {
    expect(traceabilitySummaryQueryKey(undefined, "p", "a")).toEqual([
      "orgs",
      undefined,
      "projects",
      "p",
      "artifacts",
      "a",
      "traceability-summary",
    ]);
  });
});
