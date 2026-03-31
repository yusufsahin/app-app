/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { ManualExecutionPlayerCore } from "../ManualExecutionPlayerCore";
import { renderWithQualityI18n } from "../../../../test/renderWithQualityI18n";
import * as artifactApi from "../../../../shared/api/artifactApi";

vi.mock("../../../../shared/api/artifactApi", () => ({
  useArtifact: vi.fn(),
  useUpdateArtifact: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useArtifacts: vi.fn(() => ({ data: { items: [] } })),
}));

vi.mock("../../../../shared/api/artifactLinkApi", () => ({
  useArtifactLinks: vi.fn(() => ({ data: [] })),
  sortOutgoingSuiteLinks: vi.fn(() => []),
}));

vi.mock("../../../../shared/api/manifestApi", () => ({
  useProjectManifest: vi.fn(() => ({ data: {} })),
}));

type UseArtifactReturn = ReturnType<typeof artifactApi.useArtifact>;

function mockUseArtifact(partial: Partial<UseArtifactReturn> & Record<string, unknown>): UseArtifactReturn {
  return partial as unknown as UseArtifactReturn;
}

describe("ManualExecutionPlayerCore", () => {
  const defaultProps = {
    orgSlug: "org",
    projectSlug: "proj",
    executePathProjectSlug: "proj",
    runId: "run-1",
    onExit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(artifactApi.useArtifact).mockReturnValue(
      mockUseArtifact({ isLoading: true, data: undefined, isPending: true }),
    );
  });

  it("shows loading state initially", () => {
    renderWithQualityI18n(<ManualExecutionPlayerCore {...defaultProps} />);
    expect(screen.getByRole("status")).toHaveTextContent(/initializing execution session/i);
  });

  it("shows error if run not found", () => {
    vi.mocked(artifactApi.useArtifact).mockReturnValue(
      mockUseArtifact({ data: undefined, isLoading: false, isPending: false }),
    );

    renderWithQualityI18n(<ManualExecutionPlayerCore {...defaultProps} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/run not found/i);
  });
});
