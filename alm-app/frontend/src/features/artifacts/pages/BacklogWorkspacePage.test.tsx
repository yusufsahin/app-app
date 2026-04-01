/** @vitest-environment jsdom */
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import BacklogWorkspacePage from "./BacklogWorkspacePage";
import { useArtifactStore } from "../../../shared/stores/artifactStore";
import { modalApi } from "../../../shared/modal";

const mockHandleCreateOpen = vi.fn();
const mockOpenCreateArtifactModal = vi.fn();
const mockArtifacts = [
  {
    id: "artifact-1",
    artifact_key: "SAMP-1",
    title: "Demo item",
    description: "",
    artifact_type: "epic",
    state: "new",
    tags: [],
    custom_fields: {},
    allowed_actions: ["create", "update", "delete"],
  },
];

vi.mock("../../../shared/components/ui", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/components/ui")>("../../../shared/components/ui");
  return {
    ...actual,
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      className?: string;
    }) => (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    ),
  };
});

vi.mock("../components", async () => {
  return {
    BacklogToolbar: () => <div>toolbar</div>,
    BacklogWorkspaceLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    BacklogListFooter: () => <div>footer</div>,
    BacklogTabularView: () => <div>tabular-view</div>,
    BacklogTreeView: ({
      artifacts,
      onCreateArtifact,
      renderMenuContent,
    }: {
      artifacts: Array<Record<string, unknown>>;
      onCreateArtifact: () => void;
      renderMenuContent: (artifact: Record<string, unknown>) => React.ReactNode;
    }) => (
      <div>
        <div>tree-view</div>
        <button type="button" onClick={onCreateArtifact}>
          tree-create
        </button>
        {artifacts[0] ? (
          <div>
            <button type="button" aria-label="Actions">
              Actions
            </button>
            <div>{renderMenuContent(artifacts[0])}</div>
          </div>
        ) : null}
      </div>
    ),
    ArtifactDetailSurface: () => null,
  };
});

vi.mock("../components/BacklogArtifactDetailContent", () => ({
  BacklogArtifactDetailContent: () => null,
}));

vi.mock("./useBacklogWorkspaceProject", () => ({
  useBacklogWorkspaceProject: () => ({
    orgSlug: "demo-org",
    projectSlug: "demo-project",
    project: { id: "project-1", name: "Demo Project" },
    projectsLoading: false,
  }),
}));

vi.mock("./useBacklogWorkspaceDetailState", () => ({
  useBacklogWorkspaceDetailState: () => ({
    detailDrawerTab: "details",
    setDetailDrawerTab: vi.fn(),
    auditTarget: null,
    setAuditTarget: vi.fn(),
  }),
}));

vi.mock("./useBacklogWorkspaceListFilters", () => ({
  useBacklogWorkspaceListFilters: () => ({
    toolbarForm: {
      watch: () => "",
      setValue: vi.fn(),
      getValues: () => ({}),
      control: {},
    },
    handleClearArtifactFilters: vi.fn(),
  }),
}));

vi.mock("./useBacklogWorkspaceCreateFlow", () => ({
  useBacklogWorkspaceCreateFlow: () => ({
    initialFormValues: {},
    openCreateArtifactModal: mockOpenCreateArtifactModal,
    handleCreateOpen: mockHandleCreateOpen,
  }),
}));

vi.mock("../../../shared/lib/manifestTreeRoots", () => ({
  getTreeRootsFromManifestBundle: () => [{ tree_id: "requirement", label: "Requirement" }],
}));

vi.mock("../../../shared/components/Layout", () => ({
  ProjectBreadcrumbs: ({ currentPageLabel }: { currentPageLabel: string }) => <div>{currentPageLabel}</div>,
  ProjectNotFoundView: () => <div>Project not found</div>,
}));

vi.mock("../../../shared/components/LoadingState", () => ({
  LoadingState: ({ label }: { label?: string }) => <div>{label ?? "Loading"}</div>,
}));

vi.mock("../../../shared/modal", () => ({
  modalApi: {
    openConfirm: vi.fn(),
    openBulkDelete: vi.fn(),
    openCreateArtifact: vi.fn(),
    openEditArtifact: vi.fn(),
    openDeleteArtifact: vi.fn(),
    closeModal: vi.fn(),
  },
  useModalStore: { getState: () => ({ modalType: null, updateModalProps: vi.fn() }) },
}));

vi.mock("../../../shared/stores/realtimeStore", () => ({
  useRealtimeStore: (selector: (state: { recentlyUpdatedArtifactIds: Set<string>; presenceByArtifactId: Record<string, unknown> }) => unknown) =>
    selector({ recentlyUpdatedArtifactIds: new Set<string>(), presenceByArtifactId: {} }),
}));

vi.mock("../../../shared/stores/notificationStore", () => ({
  useNotificationStore: (selector: (state: { showNotification: (...args: unknown[]) => void }) => unknown) =>
    selector({ showNotification: vi.fn() }),
}));

vi.mock("../../../shared/api/manifestApi", () => ({
  useProjectManifest: () => ({ data: { manifest_bundle: { artifact_types: [] } } }),
}));

vi.mock("../../../shared/api/listSchemaApi", () => ({
  useListSchema: () => ({
    data: {
      entity_type: "artifact",
      columns: [{ key: "title", label: "Title", order: 1 }],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../shared/api/formSchemaApi", () => ({
  useFormSchema: () => ({
    data: { entity_type: "artifact", context: "edit", fields: [], artifact_type_options: [] },
    isError: false,
    error: null,
  }),
}));

vi.mock("../../../shared/api/orgApi", () => ({
  useOrgMembers: () => ({ data: [] }),
  useProjectMembers: vi.fn(),
  useAddProjectMember: vi.fn(),
  useRemoveProjectMember: vi.fn(),
  useUpdateProjectMember: vi.fn(),
}));

vi.mock("../../../shared/api/projectTagApi", () => ({
  useProjectTags: () => ({ data: [] }),
  useCreateProjectTag: () => ({ mutate: vi.fn(), isPending: false }),
  useRenameProjectTag: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProjectTag: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../../shared/api/taskApi", () => ({
  useTasksByArtifact: () => ({ data: [], isLoading: false }),
  useMyTasksInProject: () => ({ data: [], isLoading: false }),
  useCreateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../../shared/api/relationshipApi", () => ({
  useArtifactRelationships: () => ({ data: [], isLoading: false }),
  useArtifactImpactAnalysis: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }),
  useCreateArtifactRelationship: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteArtifactRelationship: () => ({ mutate: vi.fn(), isPending: false }),
  useRelationshipTypeOptions: () => ({ data: [], isLoading: false }),
}));

vi.mock("../../../shared/api/planningApi", () => ({
  useCadences: () => ({ data: [] }),
  useAreaNodes: () => ({ data: [] }),
}));

vi.mock("../../../shared/api/attachmentApi", () => ({
  useAttachments: () => ({ data: [], isLoading: false }),
  useUploadAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  downloadAttachmentBlob: vi.fn(),
}));

vi.mock("../../../shared/api/savedQueryApi", () => ({
  useSavedQueries: () => ({ data: [] }),
  useCreateSavedQuery: () => ({ mutate: vi.fn(), isPending: false }),
  listStateToFilterParams: () => ({}),
}));

vi.mock("../../../shared/api/auditApi", () => ({
  useEntityHistory: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../../../shared/api/commentApi", () => ({
  useCommentsByArtifact: () => ({ data: [] }),
}));

vi.mock("../../../shared/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../shared/api/artifactApi", () => ({
  buildArtifactListParams: () => ({}),
  useArtifacts: () => ({
    data: { items: mockArtifacts, total: mockArtifacts.length },
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
  }),
  useArtifact: () => ({ data: null, isError: false }),
  useCreateArtifact: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePermittedTransitions: () => ({ data: [] }),
  useTransitionArtifact: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateArtifact: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteArtifact: () => ({ mutate: vi.fn(), isPending: false }),
  useBatchTransitionArtifacts: () => ({ mutate: vi.fn(), isPending: false }),
  useBatchDeleteArtifacts: () => ({ mutate: vi.fn(), isPending: false }),
  useRestoreArtifact: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("BacklogWorkspacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useArtifactStore.getState().resetListState();
    mockArtifacts.splice(
      0,
      mockArtifacts.length,
      {
        id: "artifact-1",
        artifact_key: "SAMP-1",
        title: "Demo item",
        description: "",
        artifact_type: "epic",
        state: "new",
        tags: [],
        custom_fields: {},
        allowed_actions: ["create", "update", "delete"],
      },
    );
  });

  it("defaults to tree view in default drawer mode", async () => {
    renderWithQualityI18n(
      <MemoryRouter initialEntries={["/demo-org/demo-project/backlog"]}>
        <Routes>
          <Route
            path="/:orgSlug/:projectSlug/backlog"
            element={<BacklogWorkspacePage variant="default" detailMode="drawer" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("tree-view")).toBeInTheDocument();
    });
    expect(screen.queryByText("tabular-view")).not.toBeInTheDocument();
    expect(useArtifactStore.getState().listState.viewMode).toBe("tree");
  });

  it("renders tree CRUD actions and wires them to modal flows", async () => {
    renderWithQualityI18n(
      <MemoryRouter initialEntries={["/demo-org/demo-project/backlog"]}>
        <Routes>
          <Route
            path="/:orgSlug/:projectSlug/backlog"
            element={<BacklogWorkspacePage variant="default" detailMode="drawer" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Actions")).toBeInTheDocument();
    });

    const newChild = await screen.findByText("New child");
    fireEvent.click(newChild);
    expect(mockOpenCreateArtifactModal).toHaveBeenCalled();

    fireEvent.click(await screen.findByText("Edit"));
    expect(modalApi.openEditArtifact).toHaveBeenCalled();

    fireEvent.click(await screen.findByText("Delete"));
    expect(modalApi.openDeleteArtifact).toHaveBeenCalled();
  });

  it("opens the real create flow from empty tree state", async () => {
    mockArtifacts.splice(0, mockArtifacts.length);

    renderWithQualityI18n(
      <MemoryRouter initialEntries={["/demo-org/demo-project/backlog"]}>
        <Routes>
          <Route
            path="/:orgSlug/:projectSlug/backlog"
            element={<BacklogWorkspacePage variant="default" detailMode="drawer" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("tree-create")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("tree-create"));
    expect(mockHandleCreateOpen).toHaveBeenCalled();
  });
});
