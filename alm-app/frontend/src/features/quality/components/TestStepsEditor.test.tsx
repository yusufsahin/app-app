/** @vitest-environment jsdom */
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { TestStepsEditor } from "./TestStepsEditor";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import type { TestStep } from "../types";

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
    const arg = onChange.mock.calls[0]?.[0] as TestStep[];
    expect(arg).toHaveLength(1);
    expect(arg[0]?.name).toBe("");
    expect(arg[0]?.stepNumber).toBe(1);
  });

  it("updates action field via onChange", async () => {
    const user = userEvent.setup();
    function Stateful() {
      const [steps, setSteps] = useState([baseStep({ id: "step-a", stepNumber: 1 })]);
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
    const card = screen.getByTestId("quality-step-card-s1");
    await user.hover(card);
    await user.click(screen.getByTestId("quality-step-delete-s1"));
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls.at(-1)?.[0] as TestStep[];
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
    const card = container.querySelector('[data-testid="quality-step-card-s1"]');
    expect(card).toBeTruthy();
    await user.hover(card as HTMLElement);
    const down = container.querySelector('[data-testid="quality-step-move-down-s1"]') as HTMLElement;
    await user.click(down);
    const arg = onChange.mock.calls.at(-1)?.[0] as TestStep[];
    expect(arg?.[0]?.id).toBe("s2");
    expect(arg?.[1]?.id).toBe("s1");
    expect(arg?.[0]?.stepNumber).toBe(1);
    expect(arg?.[1]?.stepNumber).toBe(2);
  });

  it("hides Add Step when readOnly", () => {
    const { container } = renderWithQualityI18n(
      <TestStepsEditor steps={[baseStep({ id: "x", name: "N" })]} onChange={vi.fn()} readOnly />,
    );
    expect(container.querySelector('[data-testid="step-add-button"]')).toBeNull();
  });
});
