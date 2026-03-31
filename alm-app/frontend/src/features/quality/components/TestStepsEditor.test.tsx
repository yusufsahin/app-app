/** @vitest-environment jsdom */
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { TestStepsEditor } from "./TestStepsEditor";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import type { TestPlanEntry, TestStep, TestPlanStepCall } from "../types";

const baseStep = (over: Partial<TestStep> & Pick<TestStep, "id">): TestStep => ({
  stepNumber: 1,
  name: "",
  description: "",
  expectedResult: "",
  status: "not-executed",
  ...over,
});

describe("TestStepsEditor", () => {
  it("calls onChange with a new step when Add Step is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithQualityI18n(<TestStepsEditor steps={[]} onChange={onChange} />);
    await user.click(screen.getByTestId("step-add-button"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0]?.[0] as TestPlanEntry[];
    expect(arg).toHaveLength(1);
    expect(arg[0]).toMatchObject({ name: "", stepNumber: 1 });
  });

  it("updates action field via onChange", async () => {
    const user = userEvent.setup();
    function Stateful() {
      const [steps, setSteps] = useState<TestPlanEntry[]>([baseStep({ id: "step-a", stepNumber: 1 })]);
      return <TestStepsEditor steps={steps} onChange={setSteps} />;
    }
    renderWithQualityI18n(<Stateful />);
    await user.type(screen.getByLabelText(/action/i), "Do the thing");
    expect(screen.getByLabelText(/action/i)).toHaveValue("Do the thing");
  });

  it("removes a step and renumbers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const steps = [
      baseStep({ id: "s1", stepNumber: 1, name: "A" }),
      baseStep({ id: "s2", stepNumber: 2, name: "B" }),
    ];
    renderWithQualityI18n(<TestStepsEditor steps={steps} onChange={onChange} />);
    await user.click(screen.getByTestId("quality-step-delete-s1"));
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls.at(-1)?.[0] as TestPlanEntry[];
    expect(arg).toHaveLength(1);
    expect(arg[0]?.id).toBe("s2");
    expect(arg[0]?.stepNumber).toBe(1);
  });

  it("moves step down with arrow button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const steps = [
      baseStep({ id: "s1", stepNumber: 1, name: "First" }),
      baseStep({ id: "s2", stepNumber: 2, name: "Second" }),
    ];
    const { container } = renderWithQualityI18n(<TestStepsEditor steps={steps} onChange={onChange} />);
    const down = container.querySelector('[data-testid="quality-step-move-down-s1"]') as HTMLElement;
    expect(down).toBeTruthy();
    await user.click(down);
    const arg = onChange.mock.calls.at(-1)?.[0] as TestPlanEntry[];
    expect(arg?.[0]?.id).toBe("s2");
    expect(arg?.[1]?.id).toBe("s1");
    expect(arg?.[0]?.stepNumber).toBe(1);
    expect(arg?.[1]?.stepNumber).toBe(2);
  });

  it("hides Add Step and Add Call when readOnly", () => {
    const { container } = renderWithQualityI18n(
      <TestStepsEditor steps={[baseStep({ id: "x", name: "N" })]} onChange={vi.fn()} readOnly />,
    );
    expect(container.querySelector('[data-testid="step-add-button"]')).toBeNull();
    expect(container.querySelector('[data-testid="step-add-call-button"]')).toBeNull();
  });

  it("pastes TSV into multiple step rows", async () => {
    const user = userEvent.setup();
    function Stateful() {
      const [st, setSt] = useState<TestPlanEntry[]>([
        baseStep({ id: "r0", stepNumber: 1, name: "" }),
        baseStep({ id: "r1", stepNumber: 2, name: "" }),
      ]);
      return <TestStepsEditor steps={st} onChange={setSt} />;
    }
    renderWithQualityI18n(<Stateful />);
    const firstAction = screen.getByLabelText(/action 1/i);
    firstAction.focus();
    await user.paste("A\tB\tC\nD\tE\tF");
    expect(screen.getByLabelText(/action 1/i)).toHaveValue("A");
    expect(screen.getByLabelText(/description 1/i)).toHaveValue("B");
    expect(screen.getByLabelText(/expected result 1/i)).toHaveValue("C");
    expect(screen.getByLabelText(/action 2/i)).toHaveValue("D");
    expect(screen.getByLabelText(/description 2/i)).toHaveValue("E");
    expect(screen.getByLabelText(/expected result 2/i)).toHaveValue("F");
  });

  it("calls onChange with a new call entry when Add Call is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithQualityI18n(<TestStepsEditor steps={[]} onChange={onChange} />);
    await user.click(screen.getByTestId("step-add-call-button"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0]?.[0] as TestPlanEntry[];
    expect(arg).toHaveLength(1);
    expect(arg[0]).toMatchObject({ kind: "call", stepNumber: 1 });
  });

  it("moves step up/down with Alt+Arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const steps = [
      baseStep({ id: "s1", stepNumber: 1, name: "First" }),
      baseStep({ id: "s2", stepNumber: 2, name: "Second" }),
    ];
    renderWithQualityI18n(<TestStepsEditor steps={steps} onChange={onChange} />);
    const firstAction = screen.getByLabelText(/action 1/i);
    firstAction.focus();
    
    // Alt+ArrowDown on first step
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls.at(-1)?.[0] as TestPlanEntry[];
    expect(arg?.[0]?.id).toBe("s2");
    expect(arg?.[1]?.id).toBe("s1");
  });

  it("displays empty state when no steps are provided", () => {
    renderWithQualityI18n(<TestStepsEditor steps={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/No steps defined/i)).toBeInTheDocument();
  });

  it("handles call parameter overrides correctly", () => {
    const onChange = vi.fn();
    const call: TestPlanStepCall = {
      kind: "call",
      id: "c1",
      stepNumber: 1,
      calledTestCaseId: "tc-123",
      calledTitle: "Sub Test",
    };
    renderWithQualityI18n(<TestStepsEditor steps={[call]} onChange={onChange} />);

    const textarea = screen.getByTestId("quality-call-param-overrides-c1");
    fireEvent.change(textarea, { target: { value: '{"key": "value"}' } });
    fireEvent.blur(textarea);
    
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls.at(-1)?.[0] as TestPlanEntry[];
    expect((arg[0] as TestPlanStepCall).paramOverrides).toEqual({ key: "value" });
  });

  it("renders mobile view when matchMedia matches", () => {
    // Mock matchMedia for mobile
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === "(min-width: 768px)" ? false : true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderWithQualityI18n(<TestStepsEditor steps={[baseStep({ id: "s1", stepNumber: 1 })]} onChange={vi.fn()} />);
    // Card layout: field label is visible; step index is on the textarea aria-label only
    expect(screen.getByText(/^Action$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/action 1/i)).toBeInTheDocument();
  });

  it("handles drag and drop reorder", async () => {
    const onChange = vi.fn();
    const steps = [
      baseStep({ id: "s1", stepNumber: 1, name: "A" }),
      baseStep({ id: "s2", stepNumber: 2, name: "B" }),
    ];
    renderWithQualityI18n(<TestStepsEditor steps={steps} onChange={onChange} />);

    const step1 = screen.getByTestId("quality-step-card-s1");
    const step2 = screen.getByTestId("quality-step-card-s2");

    // We can't easily test HTML5 drag/drop with user-event without complex setup
    // But we can trigger the events manually
    const dragStartEvent = new Event("dragstart", { bubbles: true });
    Object.defineProperty(dragStartEvent, "dataTransfer", {
      value: { 
        setData: vi.fn(),
        effectAllowed: "move"
      }
    });
    await act(async () => {
      step1.querySelector('[draggable="true"]')?.dispatchEvent(dragStartEvent);
    });

    const dragOverEvent = new Event("dragover", { bubbles: true });
    Object.defineProperty(dragOverEvent, "dataTransfer", {
      value: { dropEffect: "move" },
    });
    await act(async () => {
      step2.dispatchEvent(dragOverEvent);
    });

    const dropEvent = new Event("drop", { bubbles: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { dropEffect: "move" },
    });
    await act(async () => {
      step2.dispatchEvent(dropEvent);
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const arg = onChange.mock.calls.at(-1)?.[0] as TestPlanEntry[];
    expect(arg[0]?.id).toBe("s2");
    expect(arg[1]?.id).toBe("s1");
  });
});
