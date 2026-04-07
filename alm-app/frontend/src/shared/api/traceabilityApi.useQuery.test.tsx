/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArtifactTraceabilitySummary } from "./traceabilityApi";
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

const emptySummary = {
  artifact_id: "a1",
  artifact_key: null,
  environments: [],
  scm_links: [],
};

describe("useArtifactTraceabilitySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: emptySummary } as never);
  });

  it("GETs traceability-summary when org, project, and artifact are set", async () => {
    const { result } = renderHook(
      () => useArtifactTraceabilitySummary("acme", "proj-1", "art-9"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      "/orgs/acme/projects/proj-1/artifacts/art-9/traceability-summary",
    );
    expect(result.current.data?.artifact_id).toBe("a1");
  });

  it("does not fetch when any id is missing", () => {
    const { result } = renderHook(
      () => useArtifactTraceabilitySummary("acme", undefined, "art-9"),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
  });
});
