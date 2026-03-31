/** @vitest-environment jsdom */

import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { TestLastStatusBadge } from "./TestLastStatusBadge";

describe("TestLastStatusBadge", () => {
  it("renders nothing when item is undefined", () => {
    const { container } = renderWithQualityI18n(<TestLastStatusBadge item={undefined} />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing when run_id is missing", () => {
    const { container } = renderWithQualityI18n(
      <TestLastStatusBadge
        item={{
          test_id: "t",
          status: "passed",
          run_id: null,
          run_title: "R",
          run_updated_at: "2025-06-01T10:00:00.000Z",
          configuration_id: null,
          configuration_name: null,
          param_row_index: null,
          step_results: [],
        }}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("shows badge and tooltip with run title and date", async () => {
    const user = userEvent.setup();
    renderWithQualityI18n(
      <TestLastStatusBadge
        item={{
          test_id: "t",
          status: "failed",
          run_id: "r1",
          run_title: "Nightly",
          run_updated_at: "2025-06-01T10:00:00.000Z",
          configuration_id: null,
          configuration_name: null,
          param_row_index: null,
          step_results: [],
        }}
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    await user.hover(screen.getByText("Failed"));
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Nightly");
    });
  });
});
