/** @vitest-environment jsdom */

import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";

import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { ExecutionStepStatusBadge } from "./ExecutionStepStatusBadge";

describe("ExecutionStepStatusBadge", () => {
  it("renders em dash when status is null", () => {
    renderWithQualityI18n(<ExecutionStepStatusBadge status={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders passed label", () => {
    renderWithQualityI18n(<ExecutionStepStatusBadge status="passed" />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("renders failed with destructive styling class on badge", () => {
    const { container } = renderWithQualityI18n(<ExecutionStepStatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(container.querySelector(".bg-destructive")).toBeTruthy();
  });
});
