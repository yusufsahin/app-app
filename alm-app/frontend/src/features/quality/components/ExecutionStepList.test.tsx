/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutionStepList } from "./ExecutionStepList";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import type { StepResult, TestStep } from "../types";

const step: TestStep = {
  id: "step-1",
  stepNumber: 1,
  name: "Open app",
  description: "",
  expectedResult: "App loads",
  status: "not-executed",
};

function failedResult(stepId: string): StepResult {
  return { stepId, status: "failed", actualResult: "broken", notes: "n1" };
}

describe("ExecutionStepList", () => {
  it("sets scroll anchor id on each step card", () => {
    const onUpdate = vi.fn();
    const { container } = renderWithQualityI18n(
      <ExecutionStepList
        steps={[step]}
        results={[failedResult("step-1")]}
        onUpdateStep={onUpdate}
      />,
    );
    expect(container.querySelector("#execution-step-step-1")).toBeTruthy();
  });

  it("shows Copy Bug Report and Create defect when step failed and handlers provided", () => {
    const onUpdate = vi.fn();
    const onCopy = vi.fn();
    const onDefect = vi.fn();
    renderWithQualityI18n(
      <ExecutionStepList
        steps={[step]}
        results={[failedResult("step-1")]}
        onUpdateStep={onUpdate}
        onCopyBugReport={onCopy}
        onOpenCreateDefect={onDefect}
      />,
    );
    expect(screen.getByRole("button", { name: /copy bug report/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /create defect/i })).toBeTruthy();
  });

  it("invokes create defect with step and result when clicked", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onDefect = vi.fn();
    renderWithQualityI18n(
      <ExecutionStepList
        steps={[step]}
        results={[failedResult("step-1")]}
        onUpdateStep={onUpdate}
        onOpenCreateDefect={onDefect}
      />,
    );
    await user.click(screen.getByRole("button", { name: /create defect/i }));
    expect(onDefect).toHaveBeenCalledTimes(1);
    const call = onDefect.mock.calls[0];
    expect(call?.[0]).toMatchObject({ id: "step-1" });
    expect(call?.[1]).toMatchObject({ status: "failed", stepId: "step-1" });
  });

  it("does not show defect row when step is not failed", () => {
    const onUpdate = vi.fn();
    renderWithQualityI18n(
      <ExecutionStepList
        steps={[step]}
        results={[{ stepId: "step-1", status: "passed" }]}
        onUpdateStep={onUpdate}
        onCopyBugReport={vi.fn()}
        onOpenCreateDefect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /create defect/i })).toBeNull();
  });

  it("renders Mark All Passed when onPassAllSteps is set", async () => {
    const user = userEvent.setup();
    const onPassAll = vi.fn();
    renderWithQualityI18n(
      <ExecutionStepList
        steps={[step]}
        results={[]}
        onUpdateStep={vi.fn()}
        onPassAllSteps={onPassAll}
      />,
    );
    await user.click(screen.getByRole("button", { name: /mark all passed/i }));
    expect(onPassAll).toHaveBeenCalledTimes(1);
  });

  it("applies compact spacing class on wrapper when layoutCompact", () => {
    const { container } = renderWithQualityI18n(
      <ExecutionStepList
        steps={[step]}
        results={[]}
        onUpdateStep={vi.fn()}
        layoutCompact
      />,
    );
    const outer = container.firstElementChild;
    expect(outer?.className).toMatch(/space-y-2/);
  });

  it("uses compact padding on step card header when layoutCompact", () => {
    const { container } = renderWithQualityI18n(
      <ExecutionStepList
        steps={[step]}
        results={[failedResult("step-1")]}
        onUpdateStep={vi.fn()}
        layoutCompact
      />,
    );
    const card = container.querySelector("#execution-step-step-1");
    expect(card).toBeTruthy();
    const header = card?.querySelector('[class*="p-3"]');
    expect(header).toBeTruthy();
  });
});
