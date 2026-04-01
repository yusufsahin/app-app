/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { QualityRunsHubPanel } from "./QualityRunsHubPanel";
import { exportArtifactsFile, useArtifacts } from "../../../shared/api/artifactApi";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<object>("@tanstack/react-query");
  return {
    ...actual,
    useQueries: () => [],
  };
});

vi.mock("../../../shared/api/artifactApi", async () => {
  const actual = await vi.importActual<object>("../../../shared/api/artifactApi");
  return {
    ...actual,
    useArtifacts: vi.fn(),
    exportArtifactsFile: vi.fn(),
  };
});

vi.mock("../../artifacts/pages/useBacklogWorkspaceProject", () => ({
  useBacklogWorkspaceProject: () => ({
    orgSlug: "demo-org",
    projectSlug: "demo-project",
    project: { id: "project-1", name: "Demo" },
  }),
}));

vi.mock("../hooks/useStartSuiteRun", () => ({
  useStartSuiteRun: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const mockUseArtifacts = vi.mocked(useArtifacts);
const mockExportArtifactsFile = vi.mocked(exportArtifactsFile);

describe("QualityRunsHubPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseArtifacts.mockImplementation((...args: unknown[]) => {
      const typeFilter = args[3] as string | undefined;
      if (typeFilter === "test-suite") {
        return {
          data: { items: [{ id: "suite-1", title: "Suite 1", parent_id: "folder-1", artifact_type: "test-suite" }] },
          isPending: false,
        } as never;
      }
      return {
        data: {
          items: [
            {
              id: "run-1",
              title: "Run 1",
              artifact_key: "RUN-1",
              state: "active",
              updated_at: "2026-04-01T10:00:00Z",
              artifact_type: "test-run",
              custom_fields: { environment: "qa", run_status_counts: { passed: 1, failed: 0, blocked: 0, notExecuted: 0 } },
            },
          ],
        },
        isPending: false,
        isError: false,
        refetch: vi.fn(),
      } as never;
    });
  });

  it("offers backend export options from the runs module", async () => {
    const user = userEvent.setup();
    renderWithQualityI18n(<QualityRunsHubPanel treeId="testsuites" />);

    await user.click(screen.getByRole("button", { name: "Export runs" }));
    await user.click(screen.getByRole("menuitem", { name: "Runs XLSX" }));

    expect(mockExportArtifactsFile).toHaveBeenCalledWith(
      "demo-org",
      "project-1",
      expect.objectContaining({
        format: "xlsx",
        scope: "runs",
      }),
    );
  });
});
