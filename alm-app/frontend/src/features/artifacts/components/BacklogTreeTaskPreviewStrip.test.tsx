/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "../../../shared/api/taskApi";
import { BacklogTreeTaskPreviewStrip } from "./BacklogTreeTaskPreviewStrip";

function mkTask(over: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    project_id: "p1",
    artifact_id: "a1",
    title: "Fix the thing",
    state: "in_progress",
    description: "Details here",
    assignee_id: null,
    rank_order: null,
    team_id: null,
    created_at: null,
    updated_at: null,
    ...over,
  };
}

describe("BacklogTreeTaskPreviewStrip", () => {
  it("renders parent label, title, state, description, and rank", () => {
    const task = mkTask({
      rank_order: 3,
      tags: [{ id: "t1", name: "urgent" }],
    });

    render(
      <BacklogTreeTaskPreviewStrip
        task={task}
        parentLabel="[EPIC-1] Parent title"
        onEdit={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Task preview")).toBeInTheDocument();
    expect(screen.getByText("[EPIC-1] Parent title")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fix the thing" })).toBeInTheDocument();
    expect(screen.getByText("in_progress")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("Details here")).toBeInTheDocument();
    expect(screen.getByText(/Rank: 3/)).toBeInTheDocument();
  });

  it("resolves assignee from members display_name", () => {
    const task = mkTask({ assignee_id: "u1" });
    render(
      <BacklogTreeTaskPreviewStrip
        task={task}
        parentLabel="Parent"
        members={[{ user_id: "u1", display_name: "Ada Lovelace" }]}
        onEdit={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("omits description block when description is blank", () => {
    const task = mkTask({ description: "   " });
    const { container } = render(
      <BacklogTreeTaskPreviewStrip task={task} parentLabel="P" onEdit={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.querySelector(".whitespace-pre-wrap")).toBeNull();
  });

  it("calls onEdit and onDismiss from actions", () => {
    const onEdit = vi.fn();
    const onDismiss = vi.fn();
    render(
      <BacklogTreeTaskPreviewStrip task={mkTask()} parentLabel="P" onEdit={onEdit} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Close task preview" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
