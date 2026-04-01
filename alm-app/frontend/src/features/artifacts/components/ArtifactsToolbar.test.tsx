/** @vitest-environment jsdom */
import type React from "react";
import { describe, expect, it, vi } from "vitest";
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

vi.mock("../utils", () => ({
  downloadArtifactsCsv: vi.fn(),
}));

function ToolbarHarness() {
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
      filterStates={[]}
      bundle={{ artifact_types: [{ id: "epic", name: "Epic" }] }}
      treeRootOptions={[]}
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
      listResult={{ allowed_actions: ["create"] }}
      listColumns={[]}
      onCreateArtifact={vi.fn()}
      listStateToFilterParams={() => ({})}
      showNotification={vi.fn()}
      projectTagOptions={[]}
      onOpenTagsManager={vi.fn()}
    />
  );
}

describe("ArtifactsToolbar", () => {
  it("keeps only generic import export actions in backlog", () => {
    renderWithQualityI18n(
      <MemoryRouter>
        <ToolbarHarness />
      </MemoryRouter>,
    );

    expect(screen.getByText("Artifacts CSV")).toBeInTheDocument();
    expect(screen.getByText("Artifacts XLSX")).toBeInTheDocument();
    expect(screen.getByText("Artifact CSV template")).toBeInTheDocument();
    expect(screen.getByText("Artifact XLSX template")).toBeInTheDocument();

    expect(screen.queryByText("Test cases CSV bundle")).not.toBeInTheDocument();
    expect(screen.queryByText("Test cases XLSX")).not.toBeInTheDocument();
    expect(screen.queryByText("Test case CSV bundle template")).not.toBeInTheDocument();
    expect(screen.queryByText("Test case XLSX template")).not.toBeInTheDocument();
    expect(screen.queryByText("Runs CSV")).not.toBeInTheDocument();
    expect(screen.queryByText("Members")).not.toBeInTheDocument();
  });
});
