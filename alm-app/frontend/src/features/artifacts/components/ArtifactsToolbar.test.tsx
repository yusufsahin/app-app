/** @vitest-environment jsdom */
import type React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { MemoryRouter } from "react-router-dom";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { ArtifactsToolbar, type ToolbarFilterValues } from "./ArtifactsToolbar";

vi.mock("../../../shared/components/ui", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/components/ui")>("../../../shared/components/ui");
  return {
    ...actual,
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
    DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({ children, ...props }: React.ComponentProps<"button">) => <button type="button" {...props}>{children}</button>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ""}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Label: ({ children, ...props }: React.ComponentProps<"label">) => <label {...props}>{children}</label>,
    Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
      <input
        type="checkbox"
        aria-label="mock-checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
      />
    ),
  };
});

vi.mock("../../../shared/components/forms", () => ({
  RhfTextField: ({ placeholder }: { placeholder?: string }) => <input aria-label={placeholder ?? "text-field"} />,
  RhfSelect: ({ label }: { label?: string }) => <select aria-label={label ?? "select"} />,
  RhfCheckbox: ({ label }: { label?: string }) => <input type="checkbox" aria-label={label ?? "checkbox"} />,
}));

vi.mock("../../../shared/modal", () => ({
  modalApi: {
    openProjectMembers: vi.fn(),
    openSaveQuery: vi.fn(),
  },
}));

vi.mock("../utils", async () => {
  const actual = await vi.importActual<typeof import("../utils")>("../utils");
  return {
    ...actual,
    downloadArtifactsCsv: vi.fn(),
  };
});

type HarnessProps = {
  workItemTreeId?: string | null;
  listResult?: { allowed_actions?: string[] };
  onCreateArtifact?: (artifactTypeId: string) => void;
  bundle?: {
    artifact_types: Array<{ id: string; name?: string }>;
    defs?: Array<Record<string, unknown>>;
  };
};

function ToolbarHarness(harnessProps: HarnessProps = {}) {
  const {
    workItemTreeId = "requirement",
    listResult,
    bundle: bundleOverride,
    onCreateArtifact = vi.fn(),
  } = harnessProps;
  const toolbarForm = useForm<ToolbarFilterValues>({
    defaultValues: {
      searchInput: "",
      savedQueryId: "",
      releaseFilter: "",
      cycleFilter: "",
      areaNodeFilter: "",
      tagFilter: "",
      sortBy: "updated_at",
      sortOrder: "desc",
      showDeleted: false,
    },
  });

  return (
    <ArtifactsToolbar
      orgSlug="demo-org"
      projectSlug="demo-project"
      project={{ id: "project-1", name: "Demo", slug: "demo-project" }}
      listState={{
        viewMode: "tree",
        stateFilter: "",
        typeFilter: "",
        treeFilter: "",
        releaseFilter: "",
        cycleFilter: "",
        areaNodeFilter: "",
        tagFilter: "",
        searchInput: "",
        searchQuery: "",
        sortBy: "updated_at",
        sortOrder: "desc",
        page: 0,
        pageSize: 20,
        showDeleted: false,
        staleTraceabilityOnly: false,
        selectedIds: [],
        detailArtifactId: null,
        createOpen: false,
        transitionArtifactId: null,
        transitionTargetState: null,
        transitionStateReason: "",
        transitionResolution: "",
        bulkTransitionOpen: false,
        bulkTransitionState: "",
        bulkTransitionTrigger: "",
        bulkTransitionStateReason: "",
        bulkTransitionResolution: "",
        bulkTransitionLastResult: null,
        bulkDeleteConfirmOpen: false,
        deleteConfirmArtifactId: null,
        membersDialogOpen: false,
        addMemberUserId: "",
        addMemberRole: "PROJECT_VIEWER",
        detailDrawerEditing: false,
        editTitle: "",
        editDescription: "",
        editAssigneeId: "",
        editTitleError: "",
      }}
      setListState={vi.fn()}
      toolbarForm={toolbarForm}
      filtersPanelOpen={false}
      setFiltersPanelOpen={vi.fn()}
      myTasksMenuAnchor={null}
      setMyTasksMenuAnchor={vi.fn()}
      stateFilterOptions={[]}
      bundle={
        bundleOverride ?? {
          artifact_types: [
            { id: "root-requirement", name: "Req root" },
            { id: "epic", name: "Epic" },
            { id: "task", name: "Task" },
          ],
          defs: [
            { kind: "ArtifactType", id: "root-requirement", child_types: ["epic"] },
            { kind: "ArtifactType", id: "epic", child_types: ["task"] },
          ],
        }
      }
      treeRootOptions={[{ tree_id: "requirement", root_artifact_type: "root-requirement", label: "Req" }]}
      workItemTreeId={workItemTreeId}
      releaseCadenceOptions={[]}
      cycleNodesFlat={[]}
      areaNodesFlat={[]}
      savedQueries={[]}
      createSavedQueryMutation={{ mutate: vi.fn() }}
      myTasks={[]}
      myTasksLoading={false}
      refetchArtifacts={vi.fn()}
      isLoading={false}
      isRefetching={false}
      artifacts={[]}
      members={[]}
      listResult={listResult ?? { allowed_actions: ["create"] }}
      listColumns={[]}
      onCreateArtifact={onCreateArtifact}
      listStateToFilterParams={() => ({})}
      showNotification={vi.fn()}
      projectTagOptions={[]}
      onOpenTagsManager={vi.fn()}
    />
  );
}

describe("ArtifactsToolbar", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only generic import export actions in backlog", () => {
    renderWithQualityI18n(
      <MemoryRouter>
        <ToolbarHarness />
      </MemoryRouter>,
    );

    // Submenu mocks render duplicate nodes in the flat test DOM; assert presence, not uniqueness.
    expect(screen.getAllByText("Artifacts CSV").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Artifacts XLSX").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Artifact CSV template").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Artifact XLSX template").length).toBeGreaterThanOrEqual(1);

    expect(screen.queryByText("Test cases CSV bundle")).not.toBeInTheDocument();
    expect(screen.queryByText("Test cases XLSX")).not.toBeInTheDocument();
    expect(screen.queryByText("Test case CSV bundle template")).not.toBeInTheDocument();
    expect(screen.queryByText("Test case XLSX template")).not.toBeInTheDocument();
    expect(screen.queryByText("Runs CSV")).not.toBeInTheDocument();
    expect(screen.queryByText("Members")).not.toBeInTheDocument();
  });

  it("New work item lists only manifest-descendant types for the active tree (no system roots)", () => {
    renderWithQualityI18n(
      <MemoryRouter>
        <ToolbarHarness />
      </MemoryRouter>,
    );
    expect(screen.getByText("New work item")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Epic" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Task" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Req root" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Req root/ })).not.toBeInTheDocument();
  });

  it("hides New work item when no workItemTreeId (all trees / unspecified module)", () => {
    renderWithQualityI18n(
      <MemoryRouter>
        <ToolbarHarness workItemTreeId={null} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("New work item")).not.toBeInTheDocument();
  });

  it("renders a single primary button when exactly one creatable type exists", () => {
    const onCreate = vi.fn();
    renderWithQualityI18n(
      <MemoryRouter>
        <ToolbarHarness
          onCreateArtifact={onCreate}
          bundle={{
            artifact_types: [{ id: "epic", name: "Epic" }],
            defs: [{ kind: "ArtifactType", id: "root-requirement", child_types: ["epic"] }],
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /New Epic/i })).toBeInTheDocument();
    expect(screen.queryByText("New work item")).not.toBeInTheDocument();
  });

  it("invokes onCreateArtifact when the single-type New button is clicked", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    renderWithQualityI18n(
      <MemoryRouter>
        <ToolbarHarness
          onCreateArtifact={onCreate}
          bundle={{
            artifact_types: [{ id: "epic", name: "Epic" }],
            defs: [{ kind: "ArtifactType", id: "root-requirement", child_types: ["epic"] }],
          }}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /New Epic/i }));
    expect(onCreate).toHaveBeenCalledWith("epic");
  });

  it("hides create actions when list disallows create and no row implies create", () => {
    renderWithQualityI18n(
      <MemoryRouter>
        <ToolbarHarness listResult={{ allowed_actions: [] }} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("New work item")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Epic/i })).not.toBeInTheDocument();
  });

  it("invokes onCreateArtifact when choosing a dropdown work item type", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    renderWithQualityI18n(
      <MemoryRouter>
        <ToolbarHarness onCreateArtifact={onCreate} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Task" }));
    expect(onCreate).toHaveBeenCalledWith("task");
  });
});
