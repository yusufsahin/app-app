/** @vitest-environment jsdom */
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import BacklogWorkspacePage from "./BacklogWorkspacePage";
import { useArtifactStore } from "../../../shared/stores/artifactStore";
import { modalApi } from "../../../shared/modal";

const { useFormSchemaMock } = vi.hoisted(() => ({
  useFormSchemaMock: vi.fn(),
}));

vi.mock("../../../shared/api/formSchemaApi", () => ({
  useFormSchema: (...args: unknown[]) => useFormSchemaMock(...args),
}));

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
    openAddTask: vi.fn(),
    openEditTask: vi.fn(),
    closeModal: vi.fn(),
  },
  useModalStore: Object.assign(
    (selector: (s: { isOpened: boolean; modalType: string | null }) => unknown) =>
      selector({ isOpened: false, modalType: null }),
    { getState: () => ({ modalType: null, isOpened: false, updateModalProps: vi.fn() }) },
  ),
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
  useProjectManifest: () => ({
    data: {
      manifest_bundle: {
        artifact_types: [
          { id: "workitem", name: "Work item", child_types: [] },
          { id: "epic", name: "Epic", child_types: ["workitem"] },
        ],
      },
    },
  }),
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

vi.mock("../../../shared/api/orgApi", () => ({
  useOrgMembers: () => ({ data: [] }),
  useProjectTeams: () => ({ data: [] }),
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
  useReorderArtifactTasks: () => ({ mutate: vi.fn(), isPending: false }),
  fetchTasksForArtifact: vi.fn().mockResolvedValue([]),
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
    useFormSchemaMock.mockImplementation(
      (
        _org?: string,
        _project?: string,
        entityType = "artifact",
        context = "create",
        artifactType?: string,
        _keepPrevious?: boolean,
      ) => {
        if (entityType === "task") {
          return {
            data: { entity_type: "task", context, fields: [], artifact_type_options: [] },
            isError: false,
            error: null,
            isFetching: false,
          };
        }
        if (entityType === "artifact" && context === "edit") {
          return {
            data: { entity_type: "artifact", context: "edit", fields: [], artifact_type_options: [] },
            isError: false,
            error: null,
            isFetching: false,
          };
        }
        if (entityType === "artifact" && context === "create") {
          const mergedOrTestCase = !artifactType || artifactType === "test-case";
          const fields = [
            { key: "artifact_type", type: "choice", label_key: "Type", order: 1 },
            { key: "parent_id", type: "entity_ref", label_key: "Parent", entity_ref: "artifact", order: 2 },
            { key: "title", type: "string", label_key: "Title", order: 3 },
            ...(mergedOrTestCase
              ? [{ key: "test_steps_json", type: "string", label_key: "Steps", order: 99 }]
              : []),
          ];
          const typeOpts = artifactType
            ? [{ id: artifactType, label: artifactType }]
            : [
                { id: "workitem", label: "Work item" },
                { id: "test-case", label: "Test case" },
              ];
          return {
            data: {
              entity_type: "artifact",
              context: "create",
              fields,
              artifact_type_options: typeOpts,
            },
            isError: false,
            error: null,
            isFetching: false,
          };
        }
        return {
          data: { entity_type: artifactType ?? "artifact", context, fields: [], artifact_type_options: [] },
          isError: false,
          error: null,
          isFetching: false,
        };
      },
    );
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
    expect(mockOpenCreateArtifactModal).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: "artifact-1", artifact_type: "workitem" }),
      { hideFieldKeys: ["parent_id"] },
    );

    fireEvent.click(await screen.findByText("Edit"));
    expect(modalApi.openEditArtifact).toHaveBeenCalled();

    fireEvent.click(await screen.findByText("Add task"));
    expect(modalApi.openAddTask).toHaveBeenCalled();

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

  it("requests narrowed artifact create form-schema with default workitem type", async () => {
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

    const createCalls = useFormSchemaMock.mock.calls.filter(
      (c) => c[2] === "artifact" && c[3] === "create",
    );
    expect(createCalls.some((c) => c[4] === "workitem" && c[5] === true)).toBe(true);
  });
});
