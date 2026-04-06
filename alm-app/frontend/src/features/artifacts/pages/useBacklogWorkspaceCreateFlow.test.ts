/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormSchemaDto } from "../../../shared/types/formSchema";
import { useBacklogWorkspaceCreateFlow } from "./useBacklogWorkspaceCreateFlow";
import { modalApi } from "../../../shared/modal";

vi.mock("../../../shared/modal", () => ({
  modalApi: {
    openCreateArtifact: vi.fn(),
    closeModal: vi.fn(),
  },
  useModalStore: {
    getState: () => ({ modalType: null as string | null, updateModalProps: vi.fn() }),
  },
}));

const formSchema: FormSchemaDto = {
  entity_type: "artifact",
  context: "create",
  fields: [
    { key: "title", type: "string", label_key: "Title", order: 10 },
    { key: "parent_id", type: "entity_ref", label_key: "Parent", entity_ref: "artifact", order: 20 },
    { key: "artifact_type", type: "choice", label_key: "Type", order: 5 },
  ],
  artifact_type_options: [{ id: "epic", label: "Epic" }],
};

function setupHook() {
  const syncCreateFormArtifactType = vi.fn();
  const onCreateModalClosed = vi.fn();
  const createMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  const showNotification = vi.fn();
  const setCreateOpen = vi.fn();

  const { result } = renderHook(() =>
    useBacklogWorkspaceCreateFlow({
      formSchema,
      formSchemaError: false,
      formSchema403: false,
      members: [],
      parentPickerArtifacts: [],
      artifactTypeParentMap: { epic: ["root"] },
      systemRootTypes: new Set(["root"]),
      defaultArtifactTypeId: "epic",
      variant: "default",
      underFolderIdFromUrl: null,
      createMutation,
      setCreateOpen,
      showNotification,
      syncCreateFormArtifactType,
      onCreateModalClosed,
    }),
  );

  return {
    result,
    syncCreateFormArtifactType,
    onCreateModalClosed,
    createMutation,
    showNotification,
    setCreateOpen,
  };
}

describe("useBacklogWorkspaceCreateFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens create with hideFieldKeys for preset parent (not duplicate)", () => {
    const { result } = setupHook();
    act(() => {
      result.current.openCreateArtifactModal(
        {
          title: "",
          artifact_type: "epic",
          parent_id: "parent-uuid",
        },
        { hideFieldKeys: ["parent_id"] },
      );
    });
    const firstCall = vi.mocked(modalApi.openCreateArtifact).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCall).toEqual(expect.objectContaining({ hideFieldKeys: ["parent_id"] }));
  });

  it("duplicate flow: parent_id null does not pass hideFieldKeys for parent", () => {
    const { result } = setupHook();
    act(() => {
      result.current.openCreateArtifactModal({
        title: "Copy",
        artifact_type: "epic",
        parent_id: null,
      });
    });
    const firstCall = vi.mocked(modalApi.openCreateArtifact).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCall).toEqual(expect.objectContaining({ hideFieldKeys: undefined }));
  });

  it("passes formSchemaRefreshing false on open for parent UX effect to update", () => {
    const { result } = setupHook();
    act(() => {
      result.current.openCreateArtifactModal({ title: "", artifact_type: "epic", parent_id: null });
    });
    const firstCall = vi.mocked(modalApi.openCreateArtifact).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCall).toEqual(expect.objectContaining({ formSchemaRefreshing: false }));
  });
});
