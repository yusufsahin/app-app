/** @vitest-environment jsdom */

import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import RequirementTraceabilityMatrixPage from "./RequirementTraceabilityMatrixPage";

vi.mock("./useArtifactsPageProject", () => ({
  useArtifactsPageProject: () => ({
    orgSlug: "org",
    projectSlug: "proj",
    project: { id: "project-id", name: "Demo project" },
    projectsLoading: false,
  }),
}));

vi.mock("../../../shared/stores/notificationStore", () => ({
  useNotificationStore: (selector: (state: { showNotification: () => void }) => unknown) =>
    selector({ showNotification: vi.fn() }),
}));

vi.mock("../../../shared/api/requirementTraceabilityApi", () => ({
  useRequirementTraceabilityMatrix: () => ({
    isPending: false,
    isError: false,
    data: {
      computed_at: "2026-03-31T12:00:00.000Z",
      cache_hit: false,
      truncated: false,
      columns: [
        {
          test_id: "test-1",
          artifact_key: "TC-1",
          title: "Login test",
        },
      ],
      rows: [
        {
          requirement_id: "req-1",
          parent_id: null,
          artifact_key: "REQ-1",
          title: "Login requirement",
          cells: [
            {
              test_id: "test-1",
              linked: true,
              status: "passed",
              run_id: "run-1",
              run_title: "Run 1",
            },
          ],
        },
      ],
      relationships: [
        {
          requirement_id: "req-1",
          requirement_parent_id: null,
          requirement_artifact_key: "REQ-1",
          requirement_title: "Login requirement",
          test_id: "test-1",
          test_artifact_key: "TC-1",
          test_title: "Login test",
          link_type: "verifies",
          status: "passed",
          run_id: "run-1",
          run_title: "Run 1",
        },
      ],
    },
  }),
}));

describe("RequirementTraceabilityMatrixPage", () => {
  it("renders matrix row and relationship content", () => {
    renderWithQualityI18n(
      <MemoryRouter initialEntries={["/org/proj/requirements/traceability?tab=relationships"]}>
        <RequirementTraceabilityMatrixPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Requirement x test traceability")).toBeInTheDocument();
    expect(screen.getByText("Login requirement")).toBeInTheDocument();
    expect(screen.getAllByText("Login test").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Passed").length).toBeGreaterThan(0);
    expect(screen.getByText("verifies")).toBeInTheDocument();
  });
});
