/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ArtifactDetailDeployments } from "./ArtifactDetailDeployments";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { useArtifactTraceabilitySummary } from "../../../shared/api/traceabilityApi";
import type { ProblemDetail } from "../../../shared/api/types";

vi.mock("../../../shared/api/traceabilityApi", () => ({
  useArtifactTraceabilitySummary: vi.fn(),
}));

const mockUseSummary = vi.mocked(useArtifactTraceabilitySummary);

function renderDeployments(ui: Parameters<typeof renderWithQualityI18n>[0]) {
  return renderWithQualityI18n(<MemoryRouter>{ui}</MemoryRouter>);
}

function problem(status: number): ProblemDetail {
  return {
    type: "about:blank",
    title: status === 403 ? "Forbidden" : "Error",
    status,
    detail: "x",
    instance: "",
    correlation_id: "c1",
  };
}

describe("ArtifactDetailDeployments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading text while summary is loading", () => {
    mockUseSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);

    renderDeployments(
      <ArtifactDetailDeployments orgSlug="demo" projectSlug="proj" projectId="p1" artifactId="a1" />,
    );
    expect(screen.getByText("Loading deployment summary…")).toBeInTheDocument();
  });

  it("shows Error message when failure is a plain Error", () => {
    mockUseSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network down"),
    } as never);

    renderDeployments(
      <ArtifactDetailDeployments orgSlug="demo" projectSlug="proj" projectId="p1" artifactId="a1" />,
    );
    expect(screen.getByText("Network down")).toBeInTheDocument();
  });

  it("asks for project context when org or project is missing", () => {
    mockUseSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    renderDeployments(
      <ArtifactDetailDeployments orgSlug={undefined} projectSlug={undefined} projectId="p1" artifactId="a1" />,
    );
    expect(
      screen.getByText("Open this work item in a project context to see deployments."),
    ).toBeInTheDocument();
  });

  it("shows permission message when API returns 403 problem detail", () => {
    mockUseSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: problem(403),
    } as never);

    renderDeployments(
      <ArtifactDetailDeployments orgSlug="demo" projectSlug="proj" projectId="p1" artifactId="a1" />,
    );
    expect(
      screen.getByText("You do not have permission to view deployment traceability for this work item."),
    ).toBeInTheDocument();
  });

  it("shows generic load error for non-403 failures", () => {
    mockUseSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: problem(500),
    } as never);

    renderDeployments(
      <ArtifactDetailDeployments orgSlug="demo" projectSlug="proj" projectId="p1" artifactId="a1" />,
    );
    expect(
      screen.getByText("The server failed while loading deployments. Try again in a moment."),
    ).toBeInTheDocument();
  });

  it("renders empty-state copy when environments and scm links are empty", () => {
    mockUseSummary.mockReturnValue({
      data: {
        artifact_id: "a1",
        artifact_key: "K-1",
        environments: [],
        scm_links: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    renderDeployments(
      <ArtifactDetailDeployments orgSlug="demo" projectSlug="proj" projectId="p1" artifactId="a1" />,
    );
    expect(screen.getByText("No deployment events matched this work item yet.")).toBeInTheDocument();
    expect(
      screen.getByText("No Git links on this work item. Add PR or commit URLs under the Source tab."),
    ).toBeInTheDocument();
    const integrationsLinks = screen.getAllByRole("link", { name: "Open Integrations" });
    expect(integrationsLinks.length).toBeGreaterThan(0);
    for (const link of integrationsLinks) {
      expect(link).toHaveAttribute("href", "/demo/proj/integrations");
    }
  });

  it("renders environments and scm links from summary", () => {
    mockUseSummary.mockReturnValue({
      data: {
        artifact_id: "a1",
        artifact_key: "K-1",
        environments: [
          {
            environment: "prod",
            last_occurred_at: "2026-04-01T10:00:00Z",
            commit_sha: "a".repeat(40),
            image_digest: null,
            release_label: null,
            build_id: "b1",
            source: "api",
            matched_via: "artifact_key",
            deployment_event_id: "de-1",
          },
        ],
        scm_links: [
          {
            web_url: "https://github.com/o/r/pull/1",
            commit_sha: "b".repeat(40),
            provider: "github",
            title: "PR 1",
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    renderDeployments(
      <ArtifactDetailDeployments orgSlug="demo" projectSlug="proj" projectId="p1" artifactId="a1" />,
    );
    expect(screen.getByText("Last known deployments")).toBeInTheDocument();
    expect(screen.getByText("prod")).toBeInTheDocument();
    expect(screen.getByText("Source links")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PR 1/i })).toHaveAttribute(
      "href",
      "https://github.com/o/r/pull/1",
    );
  });
});
