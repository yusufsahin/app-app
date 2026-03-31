/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { QualityArtifactModal } from "../QualityArtifactModal";
import { renderWithQualityI18n } from "../../../../test/renderWithQualityI18n";

describe("QualityArtifactModal", () => {
  const defaultProps = {
    mode: "create" as const,
    artifactType: "test-case",
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    isPending: false,
  };

  it("renders title and description inputs", () => {
    renderWithQualityI18n(<QualityArtifactModal {...defaultProps} />);
    expect(screen.getByTestId("artifact-modal-title-input")).toBeInTheDocument();
    expect(screen.getByTestId("artifact-modal-description-input")).toBeInTheDocument();
  });

  it("calls onSubmit with entered data when Create is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithQualityI18n(<QualityArtifactModal {...defaultProps} onSubmit={onSubmit} />);
    
    await user.type(screen.getByTestId("artifact-modal-title-input"), "Test Case Title");
    await user.type(screen.getByTestId("artifact-modal-description-input"), "Test Description");
    
    await user.click(screen.getByTestId("artifact-modal-create"));
    
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: "Test Case Title",
      description: "Test Description",
    }));
  });

  it("disables Create button when title is empty", () => {
    renderWithQualityI18n(<QualityArtifactModal {...defaultProps} initialTitle="" />);
    expect(screen.getByTestId("artifact-modal-create")).toBeDisabled();
  });

  it("shows discard prompt when dirty and cancel is clicked", async () => {
    const user = userEvent.setup();
    renderWithQualityI18n(<QualityArtifactModal {...defaultProps} initialTitle="Old" />);
    
    await user.type(screen.getByTestId("artifact-modal-title-input"), "New");
    await user.click(screen.getByTestId("artifact-modal-cancel"));
    
    expect(screen.getByRole("heading", { name: /unsaved changes/i })).toBeInTheDocument();
    
    // Confirm discard
    await user.click(screen.getByTestId("artifact-modal-discard-confirm"));
    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalled());
  });

  it("renders steps editor when enableStepsEditor is true", () => {
    renderWithQualityI18n(<QualityArtifactModal {...defaultProps} enableStepsEditor={true} />);
    expect(screen.getByTestId("step-add-button")).toBeInTheDocument();
  });

  it("shows validation warning when parameters are referenced in steps but not defined", async () => {
    const steps = [
      {
        id: "s1",
        stepNumber: 1,
        name: "Use ${my_param} in the action",
        description: "",
        expectedResult: "",
        status: "not-executed" as const,
      },
    ];
    renderWithQualityI18n(<QualityArtifactModal {...defaultProps} enableStepsEditor={true} initialSteps={steps} />);
    
    const warning = screen.getByTestId("quality-params-undefined-warning");
    expect(warning).toHaveTextContent(/my_param/);
  });
});
