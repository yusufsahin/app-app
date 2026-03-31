import { describe, expect, it } from "vitest";
import type { Artifact } from "../../../shared/api/artifactApi";
import { filterRunsForHub, type RunQuickFilterId } from "./qualityRunHubFilters";

function makeRun(partial: Partial<Artifact> & { id: string }): Artifact {
  const { id, ...rest } = partial;
  return {
    project_id: "p1",
    artifact_type: "test-run",
    title: "T",
    description: "",
    assignee_id: null,
    artifact_key: "KEY-1",
    state: "open",
    parent_id: null,
    created_at: null,
    updated_at: null,
    ...rest,
    id,
  };
}

describe("filterRunsForHub", () => {
  const now = new Date("2026-03-30T12:00:00.000Z");

  it("returns all when quick is all and text empty", () => {
    const runs = [makeRun({ id: "a" }), makeRun({ id: "b" })];
    expect(filterRunsForHub(runs, { quick: "all", text: "", now })).toEqual(runs);
  });

  it("filters has_failed by run_metrics_json", () => {
    const runs = [
      makeRun({
        id: "ok",
        custom_fields: { run_metrics_json: { v: 1, results: [{ testId: "t", status: "passed", stepResults: [] }] } },
      }),
      makeRun({
        id: "bad",
        custom_fields: { run_metrics_json: { v: 1, results: [{ testId: "t", status: "failed", stepResults: [] }] } },
      }),
    ];
    const out = filterRunsForHub(runs, { quick: "has_failed", text: "", now });
    expect(out.map((r) => r.id)).toEqual(["bad"]);
  });

  it("filters last_7_days by updated_at", () => {
    const runs = [
      makeRun({ id: "old", updated_at: "2026-03-01T10:00:00.000Z" }),
      makeRun({ id: "new", updated_at: "2026-03-28T10:00:00.000Z" }),
    ];
    const out = filterRunsForHub(runs, { quick: "last_7_days", text: "", now });
    expect(out.map((r) => r.id)).toEqual(["new"]);
  });

  it("applies text filter after quick filter", () => {
    const runs = [
      makeRun({
        id: "a",
        title: "Alpha",
        custom_fields: { run_metrics_json: { v: 1, results: [{ testId: "t", status: "failed", stepResults: [] }] } },
      }),
      makeRun({
        id: "b",
        title: "Beta",
        custom_fields: { run_metrics_json: { v: 1, results: [{ testId: "t", status: "failed", stepResults: [] }] } },
      }),
    ];
    const out = filterRunsForHub(runs, { quick: "has_failed", text: "beta", now });
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });

  it("matches id substring in text filter", () => {
    const runs = [makeRun({ id: "uuid-1234-abcd", title: "X" })];
    const out = filterRunsForHub(runs, { quick: "all", text: "1234", now });
    expect(out).toHaveLength(1);
  });

  it.each(["all", "has_failed", "last_7_days"] as RunQuickFilterId[])("quick %s is stable on empty list", (quick) => {
    expect(filterRunsForHub([], { quick, text: "", now })).toEqual([]);
  });
});
