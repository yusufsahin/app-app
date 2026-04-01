/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useArtifactsTabularCommit } from "./useArtifactsTabularCommit";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { TabularCellCommitArgs, TabularColumnModel } from "../../../shared/components/lists/types";

const mockMutateAsync = vi.fn();

vi.mock("../../../shared/api/artifactApi", () => ({
  useUpdateArtifactById: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
  })),
}));

function makeRow(): Artifact {
  return {
    id: "art-1",
    artifact_key: "ART-1",
    artifact_type: "requirement",
    title: "Existing title",
    description: "",
    state: "new",
    custom_fields: { priority: "medium" },
    tags: [],
    created_at: null,
    updated_at: null,
  } as never;
}

function makeColumn(overrides: Partial<TabularColumnModel<Artifact>>): TabularColumnModel<Artifact> {
  return {
    key: "title",
    label: "Title",
    editorKind: "text",
    isSupported: true,
    isEditable: () => true,
    getRawValue: () => null,
    getDisplayValue: () => "",
    ...overrides,
  };
}

describe("useArtifactsTabularCommit", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
  });

  it("maps root fields and custom fields to the expected patch shape", async () => {
    const showNotification = vi.fn();
    const { result } = renderHook(() =>
      useArtifactsTabularCommit({
        orgSlug: "demo-org",
        projectId: "project-1",
        showNotification,
      }),
    );

    mockMutateAsync.mockResolvedValue(undefined);

    const row = makeRow();
    const titleArgs: TabularCellCommitArgs<Artifact> = {
      row,
      rowId: row.id,
      column: makeColumn({ key: "title", fieldKey: "title", writeTarget: "root" }),
      nextValue: "  New title  ",
      previousValue: "Existing title",
    };
    await result.current(titleArgs);

    const customFieldArgs: TabularCellCommitArgs<Artifact> = {
      row,
      rowId: row.id,
      column: makeColumn({ key: "priority", fieldKey: "priority", writeTarget: "custom_field" }),
      nextValue: "high",
      previousValue: "medium",
    };
    await result.current(customFieldArgs);

    expect(mockMutateAsync).toHaveBeenNthCalledWith(1, {
      artifactId: "art-1",
      patch: { title: "New title" },
    });
    expect(mockMutateAsync).toHaveBeenNthCalledWith(2, {
      artifactId: "art-1",
      patch: {
        custom_fields: {
          priority: "high",
        },
      },
    });
    expect(showNotification).not.toHaveBeenCalled();
  });

  it("maps tag and assignee updates and reports API errors", async () => {
    const showNotification = vi.fn();
    const { result } = renderHook(() =>
      useArtifactsTabularCommit({
        orgSlug: "demo-org",
        projectId: "project-1",
        showNotification,
      }),
    );

    const row = makeRow();
    mockMutateAsync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ body: { detail: "Bad assignee" } });

    await result.current({
      row,
      rowId: row.id,
      column: makeColumn({ key: "tags", fieldKey: "tag_ids", writeTarget: "root" }),
      nextValue: ["tag-1", "tag-2"],
      previousValue: [],
    });

    await expect(
      result.current({
        row,
        rowId: row.id,
        column: makeColumn({ key: "assignee_id", fieldKey: "assignee_id", writeTarget: "root" }),
        nextValue: "user-1",
        previousValue: null,
      }),
    ).rejects.toThrow("Bad assignee");

    expect(mockMutateAsync).toHaveBeenNthCalledWith(1, {
      artifactId: "art-1",
      patch: { tag_ids: ["tag-1", "tag-2"] },
    });
    expect(mockMutateAsync).toHaveBeenNthCalledWith(2, {
      artifactId: "art-1",
      patch: { assignee_id: "user-1" },
    });
    expect(showNotification).toHaveBeenCalledWith("Bad assignee", "error");
  });

  it("maps team updates and falls back to generic error messages", async () => {
    const showNotification = vi.fn();
    const { result } = renderHook(() =>
      useArtifactsTabularCommit({
        orgSlug: "demo-org",
        projectId: "project-1",
        showNotification,
      }),
    );

    const row = makeRow();
    mockMutateAsync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Unexpected failure"));

    await result.current({
      row,
      rowId: row.id,
      column: makeColumn({ key: "team_id", fieldKey: "team_id", writeTarget: "root" }),
      nextValue: "team-7",
      previousValue: null,
    });

    await expect(
      result.current({
        row,
        rowId: row.id,
        column: makeColumn({ key: "priority", fieldKey: "priority", writeTarget: "custom_field" }),
        nextValue: "low",
        previousValue: "medium",
      }),
    ).rejects.toThrow("Unexpected failure");

    expect(mockMutateAsync).toHaveBeenNthCalledWith(1, {
      artifactId: "art-1",
      patch: { team_id: "team-7" },
    });
    expect(mockMutateAsync).toHaveBeenNthCalledWith(2, {
      artifactId: "art-1",
      patch: {
        custom_fields: {
          priority: "low",
        },
      },
    });
    expect(showNotification).toHaveBeenCalledWith("Unexpected failure", "error");
  });
});
