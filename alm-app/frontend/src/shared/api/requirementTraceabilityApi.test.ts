import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { fetchRequirementTraceabilityMatrix } from "./requirementTraceabilityApi";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchRequirementTraceabilityMatrix", () => {
  it("builds the matrix endpoint with scoped params", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        computed_at: "2026-01-01T00:00:00Z",
        cache_hit: false,
        truncated: false,
        rows: [],
        columns: [],
        relationships: [],
      },
    } as never);

    await fetchRequirementTraceabilityMatrix("org", "project", {
      under: "under-id",
      scopeSuiteId: "suite-id",
      search: "login",
      includeReverseVerifies: false,
      refresh: true,
    });

    expect(getSpy).toHaveBeenCalledWith(
      "/orgs/org/projects/project/requirements/traceability-matrix?under=under-id&include_reverse_verifies=false&scope_suite_id=suite-id&search=login&refresh=true",
    );
  });
});
