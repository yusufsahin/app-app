/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ArtifactsTableView } from "./ArtifactsTableView";
import type { Artifact } from "../../../shared/api/artifactApi";
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

vi.mock("../../../shared/components/lists/MetadataDrivenGrid", () => ({
  MetadataDrivenGrid: (props: Record<string, unknown>) => (
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
      <span data-testid="grid-empty-message">{String(props.emptyMessage)}</span>
      <span data-testid="grid-selection-column">{String(props.selectionColumn)}</span>
    </div>
  ),
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
