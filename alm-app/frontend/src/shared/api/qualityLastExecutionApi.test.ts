import { beforeEach, describe, it, expect, vi } from "vitest";
import { fetchLastExecutionStatusBatch } from "./qualityLastExecutionApi";
import { apiClient } from "./client";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchLastExecutionStatusBatch", () => {
  it("returns empty array when testIds is empty", async () => {
    const post = vi.spyOn(apiClient, "post");
    await expect(fetchLastExecutionStatusBatch("org", "proj", [])).resolves.toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it("dedupes ids and preserves first-seen order", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { items: [] },
    });
    await fetchLastExecutionStatusBatch("o", "p", ["b", "a", "b", "a"]);
    expect(apiClient.post).toHaveBeenCalledWith(
      expect.any(String),
      { test_ids: ["b", "a"] },
    );
  });

  it("caps batch at 200 ids", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { items: [] },
    });
    const many = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    await fetchLastExecutionStatusBatch("o", "p", many);
    const first = vi.mocked(apiClient.post).mock.calls[0];
    expect(first).toBeDefined();
    const body = first![1] as { test_ids: string[] };
    expect(body.test_ids).toHaveLength(200);
  });

  it("fills missing step_results and items array", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        items: [
          {
            test_id: "t1",
            status: "passed",
            run_id: "r1",
            run_title: "R",
            run_updated_at: null,
            param_row_index: null,
          },
        ],
      },
    });
    const out = await fetchLastExecutionStatusBatch("o", "p", ["t1"]);
    expect(out).toHaveLength(1);
    expect(out[0]!.step_results).toEqual([]);
  });

  it("returns step_results from API when present", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        items: [
          {
            test_id: "t1",
            status: "failed",
            run_id: "r1",
            run_title: null,
            run_updated_at: null,
            param_row_index: null,
            step_results: [{ step_id: "s1", status: "passed" }],
          },
        ],
      },
    });
    const out = await fetchLastExecutionStatusBatch("o", "p", ["t1"]);
    expect(out[0]!.step_results).toEqual([{ step_id: "s1", status: "passed" }]);
  });
});
