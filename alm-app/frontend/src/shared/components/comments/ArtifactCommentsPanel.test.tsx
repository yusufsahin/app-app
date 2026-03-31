/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { ArtifactCommentsPanel } from "./ArtifactCommentsPanel";
import type { Comment } from "../../api/commentApi";

const useCommentsByArtifact = vi.hoisted(() =>
  vi.fn(() => ({
    data: [] as Comment[],
    isLoading: false,
  })),
);

const useCreateComment = vi.hoisted(() =>
  vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
);

vi.mock("../../api/commentApi", () => ({
  useCommentsByArtifact: useCommentsByArtifact,
  useCreateComment: useCreateComment,
}));

vi.mock("../../stores/notificationStore", () => ({
  useNotificationStore: vi.fn((sel: (s: { showNotification: ReturnType<typeof vi.fn> }) => unknown) =>
    sel({ showNotification: vi.fn() }),
  ),
}));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ArtifactCommentsPanel", () => {
  beforeEach(() => {
    useCommentsByArtifact.mockReturnValue({ data: [], isLoading: false });
    useCreateComment.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it("returns null when ids missing", () => {
    const { container } = renderWithClient(
      <ArtifactCommentsPanel
        orgSlug={undefined}
        projectId="p"
        artifactId="a"
        members={[]}
        canComment={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows empty list copy and comment form when canComment", () => {
    renderWithClient(
      <ArtifactCommentsPanel
        orgSlug="org"
        projectId="proj"
        artifactId="art"
        members={[]}
        canComment={true}
      />,
    );
    expect(screen.getByText("No comments yet.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Add a comment...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add comment" })).toBeTruthy();
  });

  it("lists comment bodies from query data", () => {
    useCommentsByArtifact.mockReturnValue({
      data: [
        {
          id: "c1",
          project_id: "proj",
          artifact_id: "art",
          body: "First note",
          created_by: null,
          created_at: "2020-01-01T00:00:00.000Z",
          updated_at: null,
        },
      ],
      isLoading: false,
    });
    renderWithClient(
      <ArtifactCommentsPanel
        orgSlug="org"
        projectId="proj"
        artifactId="art"
        members={[]}
        canComment={false}
      />,
    );
    expect(screen.getByText("First note")).toBeTruthy();
  });
});
