/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { describe, expect, it, vi } from "vitest";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { Task } from "../../../shared/api/taskApi";
import { ArtifactsTreeView } from "./ArtifactsTreeView";

function renderTree(ui: ReactElement) {
  return render(<DndProvider backend={HTML5Backend}>{ui}</DndProvider>);
}

const treeRoots = [{ tree_id: "requirement", root_artifact_type: "epic", label: "Requirements" }] as const;

const baseArtifact: Artifact = {
  id: "artifact-1",
  artifact_key: "SAMP-1",
  title: "Demo epic",
  description: "",
  artifact_type: "epic",
  state: "new",
  parent_id: null,
  project_id: "project-1",
  assignee_id: null,
  tags: [],
  custom_fields: {},
  allowed_actions: ["update"],
};

describe("ArtifactsTreeView", () => {
  it("shows expand chevron for a leaf before tasks are fetched (onOpenTask enables task area)", () => {
    renderTree(
      <ArtifactsTreeView
        artifacts={[baseArtifact]}
        treeRootOptions={[...treeRoots]}
        expandedIds={new Set()}
        onToggleExpand={vi.fn()}
        onOpenArtifact={vi.fn()}
        onClearFilters={vi.fn()}
        onCreateArtifact={vi.fn()}
        hasActiveArtifactFilters={false}
        emptyListTitle="Empty"
        emptyListDescription="None"
        isRefetching={false}
        renderMenuContent={() => null}
        tasksByArtifactId={new Map()}
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Expand")).toBeInTheDocument();
  });

  it("shows empty-task copy when an expanded leaf has loaded zero tasks", () => {
    renderTree(
      <ArtifactsTreeView
        artifacts={[baseArtifact]}
        treeRootOptions={[...treeRoots]}
        expandedIds={new Set(["artifact-1"])}
        onToggleExpand={vi.fn()}
        onOpenArtifact={vi.fn()}
        onClearFilters={vi.fn()}
        onCreateArtifact={vi.fn()}
        hasActiveArtifactFilters={false}
        emptyListTitle="Empty"
        emptyListDescription="None"
        isRefetching={false}
        renderMenuContent={() => null}
        tasksByArtifactId={new Map([["artifact-1", []]])}
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.getByText("No tasks for this item.")).toBeInTheDocument();
  });

  it("shows a chevron when an artifact has tasks but no child artifacts", () => {
    const tasksMap = new Map<string, Task[]>([["artifact-1", [{ id: "t1", project_id: "p", artifact_id: "artifact-1", title: "Task A", state: "todo", description: "", assignee_id: null, rank_order: null, team_id: null, created_at: null, updated_at: null }]]]);

    renderTree(
      <ArtifactsTreeView
        artifacts={[baseArtifact]}
        treeRootOptions={[...treeRoots]}
        expandedIds={new Set(["artifact-1"])}
        onToggleExpand={vi.fn()}
        onOpenArtifact={vi.fn()}
        onClearFilters={vi.fn()}
        onCreateArtifact={vi.fn()}
        hasActiveArtifactFilters={false}
        emptyListTitle="Empty"
        emptyListDescription="None"
        isRefetching={false}
        renderMenuContent={() => null}
        tasksByArtifactId={tasksMap}
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Collapse")).toBeInTheDocument();
    expect(screen.getByText("Task A")).toBeInTheDocument();
  });

  it("calls onOpenTask when a task row is clicked", () => {
    const onOpenTask = vi.fn();
    const task: Task = {
      id: "t1",
      project_id: "p",
      artifact_id: "artifact-1",
      title: "Do the thing",
      state: "todo",
      description: "",
      assignee_id: null,
      rank_order: null,
      team_id: null,
      created_at: null,
      updated_at: null,
    };
    const tasksMap = new Map<string, Task[]>([["artifact-1", [task]]]);

    renderTree(
      <ArtifactsTreeView
        artifacts={[baseArtifact]}
        treeRootOptions={[...treeRoots]}
        expandedIds={new Set(["artifact-1"])}
        onToggleExpand={vi.fn()}
        onOpenArtifact={vi.fn()}
        onClearFilters={vi.fn()}
        onCreateArtifact={vi.fn()}
        hasActiveArtifactFilters={false}
        emptyListTitle="Empty"
        emptyListDescription="None"
        isRefetching={false}
        renderMenuContent={() => null}
        tasksByArtifactId={tasksMap}
        onOpenTask={onOpenTask}
      />,
    );

    fireEvent.click(screen.getByText("Do the thing"));
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: "artifact-1" }), task);
  });

  it("shows loading row when tasks are loading and list is still empty", () => {
    const tasksMap = new Map<string, Task[]>([["artifact-1", []]]);
    const loading = new Set<string>(["artifact-1"]);

    renderTree(
      <ArtifactsTreeView
        artifacts={[baseArtifact]}
        treeRootOptions={[...treeRoots]}
        expandedIds={new Set(["artifact-1"])}
        onToggleExpand={vi.fn()}
        onOpenArtifact={vi.fn()}
        onClearFilters={vi.fn()}
        onCreateArtifact={vi.fn()}
        hasActiveArtifactFilters={false}
        emptyListTitle="Empty"
        emptyListDescription="None"
        isRefetching={false}
        renderMenuContent={() => null}
        tasksByArtifactId={tasksMap}
        tasksLoadingArtifactIds={loading}
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.getByText("Loading tasks…")).toBeInTheDocument();
  });

  it("highlights the task row when selectedTreeTask matches", () => {
    const task: Task = {
      id: "t1",
      project_id: "p",
      artifact_id: "artifact-1",
      title: "Selected task",
      state: "todo",
      description: "",
      assignee_id: null,
      rank_order: null,
      team_id: null,
      created_at: null,
      updated_at: null,
    };
    const tasksMap = new Map<string, Task[]>([["artifact-1", [task]]]);

    const { container } = renderTree(
      <ArtifactsTreeView
        artifacts={[baseArtifact]}
        treeRootOptions={[...treeRoots]}
        expandedIds={new Set(["artifact-1"])}
        onToggleExpand={vi.fn()}
        onOpenArtifact={vi.fn()}
        onClearFilters={vi.fn()}
        onCreateArtifact={vi.fn()}
        hasActiveArtifactFilters={false}
        emptyListTitle="Empty"
        emptyListDescription="None"
        isRefetching={false}
        renderMenuContent={() => null}
        tasksByArtifactId={tasksMap}
        onOpenTask={vi.fn()}
        selectedTreeTask={{ artifactId: "artifact-1", taskId: "t1" }}
      />,
    );

    const row = container.querySelector(".bg-muted\\/50");
    expect(row).toBeTruthy();
  });
});
