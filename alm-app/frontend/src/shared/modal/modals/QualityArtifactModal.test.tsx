/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/react";
import { QualityArtifactModal } from "./QualityArtifactModal";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";

function firstModalRoot(container: HTMLElement) {
  const el = container.querySelector('[data-testid="quality-artifact-modal"]');
  expect(el).toBeTruthy();
  return el as HTMLElement;
}

describe("QualityArtifactModal", () => {
  it("disables save/create when title is empty and steps editor enabled", () => {
    const { container } = renderWithQualityI18n(
      <QualityArtifactModal
        mode="create"
        artifactType="test-case"
        initialTitle=""
        enableStepsEditor
        isPending={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(within(firstModalRoot(container)).getByTestId("artifact-modal-create")).toBeDisabled();
  });

  it("disables create when a step has empty action", async () => {
    const user = userEvent.setup();
    const { container } = renderWithQualityI18n(
      <QualityArtifactModal
        mode="create"
        artifactType="test-case"
        initialTitle="My test"
        enableStepsEditor
        isPending={false}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const modal = firstModalRoot(container);
    await user.click(within(modal).getByTestId("step-add-button"));
    expect(within(modal).getByTestId("artifact-modal-create")).toBeDisabled();
    await user.type(within(modal).getByLabelText(/action/i), "Step action");
    expect(within(modal).getByTestId("artifact-modal-create")).not.toBeDisabled();
  });

  it("calls onSubmit with normalized steps", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithQualityI18n(
      <QualityArtifactModal
        mode="create"
        artifactType="test-case"
        initialTitle="T"
        enableStepsEditor
        isPending={false}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );
    const modal = firstModalRoot(container);
    await user.click(within(modal).getByTestId("step-add-button"));
    await user.type(within(modal).getByLabelText(/action/i), "Act");
    await user.click(within(modal).getByTestId("artifact-modal-create"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "T",
        steps: expect.arrayContaining([expect.objectContaining({ name: "Act", stepNumber: 1 })]),
      }),
    );
  });
});
