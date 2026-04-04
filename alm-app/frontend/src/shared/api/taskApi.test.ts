/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  fetchTasksForArtifact,
  useCreateTask,
  useDeleteTask,
  useUpdateTask,
  type Task,
} from "./taskApi";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function mkTask(id: string): Task {
  return {
    id,
    project_id: "p1",
    artifact_id: "a1",
    title: "t",
    state: "todo",
    description: "",
    assignee_id: null,
    rank_order: null,
    team_id: null,
    created_at: null,
    updated_at: null,
  };
}

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchTasksForArtifact", () => {
  it("GETs tasks and omits params when teamId is null", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [mkTask("1")] });
    const out = await fetchTasksForArtifact("my-org", "proj-1", "art-1", null);
    expect(out).toEqual([mkTask("1")]);
    expect(apiClient.get).toHaveBeenCalledWith("/orgs/my-org/projects/proj-1/artifacts/art-1/tasks", {
      params: undefined,
    });
  });

  it("passes team_id when teamId is set", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await fetchTasksForArtifact("o", "p", "a", "team-x");
    expect(apiClient.get).toHaveBeenCalledWith("/orgs/o/projects/p/artifacts/a/tasks", {
      params: { team_id: "team-x" },
    });
  });
});

describe("task mutations", () => {
  it("useCreateTask POSTs to artifact-scoped path with body", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: mkTask("new") });
    const { result } = renderHook(() => useCreateTask("org", "pr"), { wrapper: createWrapper() });

    await result.current.mutateAsync({ artifactId: "art-99", title: "Hello", state: "doing" });

    expect(apiClient.post).toHaveBeenCalledWith("/orgs/org/projects/pr/artifacts/art-99/tasks", {
      title: "Hello",
      description: "",
      state: "doing",
    });
  });

  it("useUpdateTask PATCHes task id under artifact", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: mkTask("1") });
    const { result } = renderHook(() => useUpdateTask("org", "pr"), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      artifactId: "art-1",
      taskId: "task-1",
      title: "Updated",
      description: "d",
    });

    expect(apiClient.patch).toHaveBeenCalledWith("/orgs/org/projects/pr/artifacts/art-1/tasks/task-1", {
      title: "Updated",
      description: "d",
    });
  });

  it("useDeleteTask DELETEs task", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteTask("org", "pr"), { wrapper: createWrapper() });

    await result.current.mutateAsync({ artifactId: "art-1", taskId: "task-1" });

    expect(apiClient.delete).toHaveBeenCalledWith("/orgs/org/projects/pr/artifacts/art-1/tasks/task-1");
  });

  it("useCreateTask invalidates artifact tasks queries on success", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: mkTask("n") });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: qc }, children);
    }

    const { result } = renderHook(() => useCreateTask("o", "p"), { wrapper: Wrapper });

    await result.current.mutateAsync({ artifactId: "a-target", title: "x" });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["orgs", "o", "projects", "p", "artifacts", "a-target", "tasks"],
    });
  });
});
