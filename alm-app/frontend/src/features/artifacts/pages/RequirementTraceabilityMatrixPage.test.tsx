/** @vitest-environment jsdom */

import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import RequirementTraceabilityMatrixPage from "./RequirementTraceabilityMatrixPage";

const setSearchParamsMock = vi.fn();

const matrixHookMock = vi.fn();
const summaryHookMock = vi.fn();

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

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams("tab=relationships"), setSearchParamsMock],
  };
});

vi.mock("../../../shared/api/requirementTraceabilityApi", () => ({
  useRequirementTraceabilityMatrix: (...args: unknown[]) => matrixHookMock(...args),
  useRequirementTraceabilityMatrixSummary: (...args: unknown[]) => summaryHookMock(...args),
}));

describe("RequirementTraceabilityMatrixPage", () => {
  beforeEach(() => {
    setSearchParamsMock.mockReset();
    matrixHookMock.mockReset();
    summaryHookMock.mockReset();

    matrixHookMock.mockReturnValue({
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
    });

    summaryHookMock.mockReturnValue({
      data: {
        computed_at: "2026-03-31T12:00:00.000Z",
        cache_hit: false,
        project_node_count: 40,
        subtree_node_count: 12,
        candidate_requirement_row_count: 1,
        distinct_test_count: 1,
        relationship_count: 1,
        can_render_matrix: true,
        exceeds_project_without_under_limit: false,
        exceeds_subtree_limit: false,
        exceeds_row_limit: false,
        exceeds_column_limit: false,
        applied_search: null,
        child_subtrees: [
          {
            artifact_id: "child-1",
            parent_id: null,
            artifact_key: "REQ-AREA-1",
            title: "Authentication",
            subtree_node_count: 5,
            requirement_row_count: 1,
            relationship_count: 1,
            distinct_test_count: 1,
          },
        ],
      },
    });
  });

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

  it("applies subtree filter when a child subtree card is clicked", async () => {
    const user = userEvent.setup();
    renderWithQualityI18n(
      <MemoryRouter initialEntries={["/org/proj/requirements/traceability"]}>
        <RequirementTraceabilityMatrixPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Authentication/i }));

    expect(setSearchParamsMock).toHaveBeenCalled();
    const firstCall = setSearchParamsMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const updater = firstCall![0] as (prev: URLSearchParams) => URLSearchParams;
    const next = updater(new URLSearchParams(""));
    expect(next.get("under")).toBe("child-1");
  });

  it("shows summary guidance and blocks matrix when the slice is too large", () => {
    summaryHookMock.mockReturnValue({
      data: {
        computed_at: "2026-03-31T12:00:00.000Z",
        cache_hit: false,
        project_node_count: 900,
        subtree_node_count: 600,
        candidate_requirement_row_count: 300,
        distinct_test_count: 220,
        relationship_count: 1800,
        can_render_matrix: false,
        exceeds_project_without_under_limit: true,
        exceeds_subtree_limit: false,
        exceeds_row_limit: true,
        exceeds_column_limit: true,
        applied_search: null,
        child_subtrees: [],
      },
    });

    renderWithQualityI18n(
      <MemoryRouter initialEntries={["/org/proj/requirements/traceability"]}>
        <RequirementTraceabilityMatrixPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Narrow before rendering")).toBeInTheDocument();
    expect(screen.getAllByText("Current slice is too large for a readable matrix").length).toBeGreaterThan(0);
    expect(screen.getByText("Project-wide scope is too large without an `under` subtree root.")).toBeInTheDocument();
  });
});
