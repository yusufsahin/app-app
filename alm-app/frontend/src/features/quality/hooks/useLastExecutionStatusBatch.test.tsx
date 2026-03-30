/** @vitest-environment jsdom */

import * as React from "react";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, it, expect, vi } from "vitest";

import { apiClient } from "../../../shared/api/client";
import {
  lastExecutionStatusMap,
  useLastExecutionStatusBatch,
} from "./useLastExecutionStatusBatch";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("lastExecutionStatusMap", () => {
  it("returns empty map for undefined", () => {
    expect(lastExecutionStatusMap(undefined).size).toBe(0);
  });

  it("maps items by test_id", () => {
    const m = lastExecutionStatusMap([
      {
        test_id: "a",
        status: "passed",
        run_id: "r",
        run_title: null,
        run_updated_at: null,
        param_row_index: null,
        step_results: [],
      },
    ]);
    expect(m.get("a")?.status).toBe("passed");
  });
});

describe("useLastExecutionStatusBatch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("is disabled when orgSlug or projectId is missing", () => {
    const post = vi.spyOn(apiClient, "post");
    const { result } = renderHook(
      () => useLastExecutionStatusBatch(undefined, "p", ["a"]),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(post).not.toHaveBeenCalled();
  });

  it("fetches with sorted unique ids in query key order", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        items: [
          {
            test_id: "b",
            status: null,
            run_id: null,
            run_title: null,
            run_updated_at: null,
            param_row_index: null,
            step_results: [],
          },
        ],
      },
    });

    const { result } = renderHook(
      () => useLastExecutionStatusBatch("org", "proj", ["b", "a", "b"]),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith(
      "/orgs/org/projects/proj/quality/last-execution-status",
      { test_ids: ["a", "b"] },
    );
    expect(result.current.data?.[0]?.test_id).toBe("b");
  });

  it("refetches when sorted id list changes", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: { items: [] },
    });

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useLastExecutionStatusBatch("o", "p", ids),
      {
        wrapper: createWrapper(),
        initialProps: { ids: ["x"] as string[] },
      },
    );

    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ ids: ["x", "y"] });
    });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });
});
