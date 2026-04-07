/** @vitest-environment jsdom */
/**
 * useArtifacts: React Query wiring for list filters (incl. stale_traceability_only).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArtifacts } from "./artifactApi";
import { apiClient } from "./client";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

/** Explicit optional args: state → unassignedOnly (18), then queryEnabled, staleTraceabilityOnly. */
function useArtifactsStaleOnly(staleTraceabilityOnly: boolean, queryEnabled = true) {
  return useArtifacts(
    "acme",
    "proj-1",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    queryEnabled,
    staleTraceabilityOnly,
  );
}

describe("useArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: { items: [], total: 0, allowed_actions: ["read"] },
    } as never);
  });

  it("requests stale_traceability_only when staleTraceabilityOnly is true", async () => {
    const { result } = renderHook(() => useArtifactsStaleOnly(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith("/orgs/acme/projects/proj-1/artifacts", {
      params: { stale_traceability_only: true },
    });
  });

  it("does not send stale_traceability_only when staleTraceabilityOnly is false", async () => {
    const { result } = renderHook(() => useArtifactsStaleOnly(false), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith("/orgs/acme/projects/proj-1/artifacts", {
      params: undefined,
    });
  });
});
