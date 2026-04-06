/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ArtifactsTableView } from "./ArtifactsTableView";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { Task } from "../../../shared/api/taskApi";
import type { TenantMember } from "../../../shared/api/orgApi";
import type { ProjectTag } from "../../../shared/api/projectTagApi";
import type { ListSchemaDto } from "../../../shared/types/listSchema";
import type { FormSchemaDto } from "../../../shared/types/formSchema";

const mockUseArtifactsTabularColumns = vi.fn();
const mockUseArtifactsTabularRows = vi.fn();
const mockUseArtifactsTabularCommit = vi.fn();

vi.mock("./useArtifactsTabularColumns", () => ({
  useArtifactsTabularColumns: (...args: unknown[]) => mockUseArtifactsTabularColumns(...args),
}));

vi.mock("./useArtifactsTabularRows", () => ({
  useArtifactsTabularRows: (...args: unknown[]) => mockUseArtifactsTabularRows(...args),
}));

vi.mock("./useArtifactsTabularCommit", () => ({
  useArtifactsTabularCommit: (...args: unknown[]) => mockUseArtifactsTabularCommit(...args),
}));

let lastMetadataDrivenGridProps: Record<string, unknown> = {};

vi.mock("../../../shared/components/lists/MetadataDrivenGrid", () => ({
  MetadataDrivenGrid: (props: Record<string, unknown>) => {
    lastMetadataDrivenGridProps = props;
    return (
      <div data-testid="metadata-driven-grid">
        <button type="button" onClick={() => (props.onRowOpen as ((row: Artifact) => void) | undefined)?.(sampleArtifacts[0]!)}>
          open-row
        </button>
        <button
          type="button"
          onClick={() =>
            ((props.columns as Array<{ key: string; renderDisplay?: (row: Artifact, value: unknown) => unknown }>)?.find(
              (column) => column.key === "tags",
            )?.renderDisplay?.(sampleArtifacts[0]!, ["tag-1"]) as { props?: { onCommit?: (nextValue: string[]) => void } } | undefined)?.props?.onCommit?.([
              "tag-2",
            ])
          }
        >
          commit-tags
        </button>
        <button
          type="button"
          onClick={() =>
            ((props.columns as Array<{ key: string; renderDisplay?: (row: Artifact, value: unknown) => unknown }>)?.find(
              (column) => column.key === "assignee_id",
            )?.renderDisplay?.(sampleArtifacts[0]!, "user-1") as { props?: { onCommit?: (nextValue: string | null) => void } } | undefined)?.props?.onCommit?.(
              "user-2",
            )
          }
        >
          commit-assignee
        </button>
        {typeof props.renderRowActions === "function" ? (
          <div data-testid="mock-row-actions">{props.renderRowActions(sampleArtifacts[0]!)}</div>
        ) : null}
        {typeof props.renderExpandedRow === "function" ? (
          <div data-testid="mock-expanded-slot">{(props.renderExpandedRow as (row: Artifact) => ReactNode)(sampleArtifacts[0]!)}</div>
        ) : null}
        <span data-testid="grid-empty-message">{String(props.emptyMessage)}</span>
        <span data-testid="grid-selection-column">{String(props.selectionColumn)}</span>
      </div>
    );
  },
}));

const sampleArtifacts: Artifact[] = [
  {
    id: "art-1",
    project_id: "project-1",
    artifact_type: "requirement",
    title: "Artifact A",
    description: "",
    state: "new",
    assignee_id: "user-1",
    parent_id: null,
    tags: [{ id: "tag-1", name: "Platform" }],
    custom_fields: {},
  },
];

const sampleTask: Task = {
  id: "task-1",
  project_id: "project-1",
  artifact_id: "art-1",
  title: "Task Alpha",
  state: "new",
  description: "",
  assignee_id: null,
  rank_order: null,
  team_id: null,
  original_estimate_hours: null,
  remaining_work_hours: null,
  activity: null,
  created_at: null,
  updated_at: null,
};

const sampleMembers: TenantMember[] = [
  {
    user_id: "user-1",
    email: "ada@example.com",
    display_name: "Ada Lovelace",
    roles: [],
    joined_at: "2026-01-01T00:00:00Z",
  },
  {
    user_id: "user-2",
    email: "grace@example.com",
    display_name: "Grace Hopper",
    roles: [],
    joined_at: "2026-01-02T00:00:00Z",
  },
];

const sampleTags: ProjectTag[] = [
  { id: "tag-1", project_id: "project-1", name: "Platform" },
  { id: "tag-2", project_id: "project-1", name: "UX" },
];

const listSchema: ListSchemaDto = {
  entity_type: "artifact",
  columns: [
    { key: "artifact_type", label: "Type", order: 1 },
    { key: "tags", label: "Tags", order: 2 },
    { key: "assignee_id", label: "Assignee", order: 3 },
  ],
};

const formSchema: FormSchemaDto = {
  entity_type: "artifact",
  context: "edit",
  fields: [],
};

beforeEach(() => {
  lastMetadataDrivenGridProps = {};
  mockUseArtifactsTabularColumns.mockReset();
  mockUseArtifactsTabularRows.mockReset();
  mockUseArtifactsTabularCommit.mockReset();
  mockUseArtifactsTabularColumns.mockReturnValue([]);
  mockUseArtifactsTabularRows.mockReturnValue(sampleArtifacts);
  mockUseArtifactsTabularCommit.mockReturnValue(vi.fn());
});

function renderView(overrides: Partial<ComponentProps<typeof ArtifactsTableView>> = {}) {
  const commitSpy = vi.fn().mockResolvedValue(undefined);
  mockUseArtifactsTabularColumns.mockReturnValue([
    { key: "artifact_type", isEditable: () => false },
    { key: "tags", isEditable: () => true },
    { key: "assignee_id", isEditable: () => true },
  ]);
  mockUseArtifactsTabularRows.mockReturnValue(sampleArtifacts);
  mockUseArtifactsTabularCommit.mockReturnValue(commitSpy);

  const props: ComponentProps<typeof ArtifactsTableView> = {
    orgSlug: "demo-org",
    projectId: "project-1",
    effectiveListSchema: listSchema,
    editFormSchema: formSchema,
    members: sampleMembers,
    projectTags: sampleTags,
    artifacts: sampleArtifacts,
    renderCell: vi.fn(() => <span>custom-render</span>),
    showDeleted: false,
    selectedKeys: new Set<string>(),
    onToggleSelect: vi.fn(),
    onSelectAll: vi.fn(),
    renderRowActions: vi.fn(() => <button type="button">actions</button>),
    emptyTableMessage: "No artifacts",
    onRowClick: vi.fn(),
    isRefetching: false,
    listSchemaLoading: false,
    listSchemaError: false,
    refetchListSchema: vi.fn(),
    showNotification: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<ArtifactsTableView {...props} />),
    props,
    commitSpy,
  };
}

describe("ArtifactsTableView", () => {
  it("wires shared hooks into the grid and forwards picker commits", () => {
    const { props, commitSpy } = renderView();

    expect(mockUseArtifactsTabularColumns).toHaveBeenCalledWith({
      listSchema,
      formSchema,
      manifestBundle: null,
      members: sampleMembers,
      projectTags: sampleTags,
    });
    expect(mockUseArtifactsTabularRows).toHaveBeenCalledWith(sampleArtifacts);
    expect(mockUseArtifactsTabularCommit).toHaveBeenCalledWith({
      orgSlug: "demo-org",
      projectId: "project-1",
      showNotification: props.showNotification,
    });

    fireEvent.click(screen.getByText("open-row"));
    expect(props.onRowClick).toHaveBeenCalledWith(sampleArtifacts[0]);

    fireEvent.click(screen.getByText("commit-tags"));
    expect(commitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: "art-1",
        nextValue: ["tag-2"],
        previousValue: ["tag-1"],
      }),
    );

    fireEvent.click(screen.getByText("commit-assignee"));
    expect(commitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: "art-1",
        nextValue: "user-2",
        previousValue: "user-1",
      }),
    );

    expect(screen.getByTestId("grid-empty-message")).toHaveTextContent("No artifacts");
    expect(screen.getByTestId("grid-selection-column")).toHaveTextContent("true");
  });

  it("forwards table-row expansion props to MetadataDrivenGrid and shows a helper hint", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    renderView({
      expandedTableRowKeys: new Set<string>(),
      onToggleTableExpandRow: onToggle,
      onOpenTableTask: onOpen,
      tasksByArtifactId: new Map([["art-1", [sampleTask]]]),
    });

    expect(screen.getByText("Use arrow next to actions to show tasks.")).toBeInTheDocument();
    expect(lastMetadataDrivenGridProps.expandedDetailRowKeys).toEqual(new Set<string>());
    expect(typeof lastMetadataDrivenGridProps.renderExpandedRow).toBe("function");

    fireEvent.click(screen.getByRole("button", { name: /expand tasks for artifact a/i }));
    expect(onToggle).toHaveBeenCalledWith("art-1");
  });

  it("renders expanded tasks and calls onOpenTableTask when a task row is clicked", () => {
    const onOpen = vi.fn();
    renderView({
      expandedTableRowKeys: new Set(["art-1"]),
      onToggleTableExpandRow: vi.fn(),
      onOpenTableTask: onOpen,
      tasksByArtifactId: new Map([["art-1", [sampleTask]]]),
    });

    fireEvent.click(screen.getByText("Task Alpha"));
    expect(onOpen).toHaveBeenCalledWith(sampleArtifacts[0], sampleTask);
  });

  it("shows loading state for expanded tasks", () => {
    renderView({
      expandedTableRowKeys: new Set(["art-1"]),
      onToggleTableExpandRow: vi.fn(),
      onOpenTableTask: vi.fn(),
      tasksByArtifactId: new Map([["art-1", []]]),
      tasksLoadingArtifactIds: new Set(["art-1"]),
    });

    expect(screen.getByText("Loading tasks…")).toBeInTheDocument();
  });

  it("shows tasks while refetching when cached tasks exist (no loading-only placeholder)", () => {
    renderView({
      expandedTableRowKeys: new Set(["art-1"]),
      onToggleTableExpandRow: vi.fn(),
      onOpenTableTask: vi.fn(),
      tasksByArtifactId: new Map([["art-1", [sampleTask]]]),
      tasksLoadingArtifactIds: new Set(["art-1"]),
    });

    expect(screen.getByText("Task Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Loading tasks…")).not.toBeInTheDocument();
  });

  it("shows empty-task copy when expanded but there are no tasks", () => {
    renderView({
      expandedTableRowKeys: new Set(["art-1"]),
      onToggleTableExpandRow: vi.fn(),
      onOpenTableTask: vi.fn(),
      tasksByArtifactId: new Map([["art-1", []]]),
      tasksLoadingArtifactIds: new Set(),
    });

    expect(screen.getByText("No tasks for this item.")).toBeInTheDocument();
  });

  it("does not pass expansion to the grid when onOpenTableTask is missing (chevron can still toggle)", () => {
    renderView({
      expandedTableRowKeys: new Set<string>(),
      onToggleTableExpandRow: vi.fn(),
      tasksByArtifactId: new Map(),
    });

    expect(screen.queryByText("Use arrow next to actions to show tasks.")).not.toBeInTheDocument();
    expect(lastMetadataDrivenGridProps.renderExpandedRow).toBeUndefined();
    expect(lastMetadataDrivenGridProps.expandedDetailRowKeys).toBeUndefined();
  });

  it("uses collapse label on the expand chevron when the row is expanded", () => {
    renderView({
      expandedTableRowKeys: new Set(["art-1"]),
      onToggleTableExpandRow: vi.fn(),
      onOpenTableTask: vi.fn(),
      tasksByArtifactId: new Map([["art-1", [sampleTask]]]),
    });

    expect(screen.getByRole("button", { name: /collapse tasks for artifact a/i })).toBeInTheDocument();
  });

  it("applies selected styles when selectedTableTask matches a task", () => {
    renderView({
      expandedTableRowKeys: new Set(["art-1"]),
      onToggleTableExpandRow: vi.fn(),
      onOpenTableTask: vi.fn(),
      tasksByArtifactId: new Map([["art-1", [sampleTask]]]),
      selectedTableTask: { artifactId: "art-1", taskId: "task-1" },
    });

    expect(screen.getByText("Task Alpha").closest("li")).toHaveClass("bg-muted/40");
  });

  it("invokes onEditTableTask and onDeleteTableTask from the task overflow menu", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderView({
      expandedTableRowKeys: new Set(["art-1"]),
      onToggleTableExpandRow: vi.fn(),
      onOpenTableTask: vi.fn(),
      onEditTableTask: onEdit,
      onDeleteTableTask: onDelete,
      tasksByArtifactId: new Map([["art-1", [sampleTask]]]),
    });

    await user.click(screen.getByRole("button", { name: "Task actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(sampleArtifacts[0], sampleTask);

    await user.click(screen.getByRole("button", { name: "Task actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(sampleArtifacts[0], sampleTask);
  });

  it("shows loading, error, and unavailable schema fallbacks", () => {
    const refetchListSchema = vi.fn();
    const { rerender } = render(
      <ArtifactsTableView
        artifacts={sampleArtifacts}
        renderCell={() => null}
        showDeleted={false}
        selectedKeys={new Set<string>()}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        renderRowActions={() => null}
        emptyTableMessage="No artifacts"
        onRowClick={vi.fn()}
        isRefetching={false}
        listSchemaLoading
        listSchemaError={false}
        refetchListSchema={refetchListSchema}
        showNotification={vi.fn()}
      />
    );

    expect(screen.getByText("Loading list schema…")).toBeInTheDocument();

    rerender(
      <ArtifactsTableView
        artifacts={sampleArtifacts}
        renderCell={() => null}
        showDeleted={false}
        selectedKeys={new Set<string>()}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        renderRowActions={() => null}
        emptyTableMessage="No artifacts"
        onRowClick={vi.fn()}
        isRefetching={false}
        listSchemaLoading={false}
        listSchemaError
        refetchListSchema={refetchListSchema}
        showNotification={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Try again"));
    expect(refetchListSchema).toHaveBeenCalled();

    rerender(
      <ArtifactsTableView
        artifacts={sampleArtifacts}
        renderCell={() => null}
        showDeleted={false}
        selectedKeys={new Set<string>()}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        renderRowActions={() => null}
        emptyTableMessage="No artifacts"
        onRowClick={vi.fn()}
        isRefetching={false}
        listSchemaLoading={false}
        listSchemaError={false}
        refetchListSchema={refetchListSchema}
        showNotification={vi.fn()}
      />
    );

    expect(
      screen.getByText("List schema is not available. Switch to Tree or Tabular view, or try again later."),
    ).toBeInTheDocument();
  });
});
