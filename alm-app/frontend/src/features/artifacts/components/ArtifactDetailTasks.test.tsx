/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "../../../shared/api/taskApi";
import { Tabs } from "../../../shared/components/ui";
import { ArtifactDetailTasks } from "./ArtifactDetailTasks";

function renderTasks(props: ComponentProps<typeof ArtifactDetailTasks>) {
  return render(
    <DndProvider backend={HTML5Backend}>
      <Tabs value="tasks">
        <ArtifactDetailTasks {...props} />
      </Tabs>
    </DndProvider>,
  );
}

const sampleTask: Task = {
  id: "t1",
  project_id: "p1",
  artifact_id: "a1",
  title: "Example task",
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

describe("ArtifactDetailTasks", () => {
  it("does not render duplicate work item tags (header is single source)", () => {
    renderTasks({
      tasks: [sampleTask],
      tasksLoading: false,
      members: [],
      onEditTask: vi.fn(),
      onDeleteTask: vi.fn(),
      onAddTask: vi.fn(),
    });

    expect(screen.queryByLabelText("Work item tags")).not.toBeInTheDocument();
    expect(screen.queryByText("Work item tags")).not.toBeInTheDocument();
    expect(screen.getByText("Example task")).toBeInTheDocument();
  });

  it("shows Add task with an empty task list", () => {
    renderTasks({
      tasks: [],
      tasksLoading: false,
      members: [],
      onEditTask: vi.fn(),
      onDeleteTask: vi.fn(),
      onAddTask: vi.fn(),
    });

    expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument();
  });

  it("shows skeleton while loading", () => {
    const { container } = renderTasks({
      tasks: [],
      tasksLoading: true,
      members: [],
      onEditTask: vi.fn(),
      onDeleteTask: vi.fn(),
      onAddTask: vi.fn(),
    });

    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it("highlights the task row matching highlightedTaskId", () => {
    const t2: Task = { ...sampleTask, id: "t2", title: "Other" };
    const { container } = renderTasks({
      tasks: [sampleTask, t2],
      tasksLoading: false,
      members: [],
      highlightedTaskId: "t2",
      onEditTask: vi.fn(),
      onDeleteTask: vi.fn(),
      onAddTask: vi.fn(),
    });

    const rows = container.querySelectorAll("[data-task-row-id]");
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toHaveClass("bg-muted/50");
    expect(rows[1]).toHaveClass("bg-muted/50");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
  });
});
