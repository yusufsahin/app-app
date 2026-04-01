/** @vitest-environment jsdom */
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import QualityDefectsPage from "./QualityDefectsPage";
import { useArtifacts } from "../../../shared/api/artifactApi";
import { useFormSchema } from "../../../shared/api/formSchemaApi";
import { useListSchema } from "../../../shared/api/listSchemaApi";
import { useOrgMembers } from "../../../shared/api/orgApi";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useCreateArtifactCommentMutation } from "../../../shared/api/commentApi";
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import { useAuthStore } from "../../../shared/stores/authStore";

vi.mock("../../artifacts/pages/useBacklogWorkspaceProject", () => ({
  useBacklogWorkspaceProject: vi.fn(),
}));

vi.mock("../../../shared/api/artifactApi", () => ({
  useArtifacts: vi.fn(),
  useCreateArtifact: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock("../../../shared/api/formSchemaApi", () => ({
  useFormSchema: vi.fn(),
}));

vi.mock("../../../shared/api/listSchemaApi", () => ({
  useListSchema: vi.fn(),
}));

vi.mock("../../../shared/api/orgApi", () => ({
  useOrgMembers: vi.fn(),
}));

vi.mock("../../../shared/api/manifestApi", () => ({
  useProjectManifest: vi.fn(),
}));

vi.mock("../../../shared/api/commentApi", () => ({
  useCreateArtifactCommentMutation: vi.fn(),
}));

vi.mock("../../../shared/components/Layout", () => ({
  ProjectBreadcrumbs: ({ currentPageLabel }: { currentPageLabel: string }) => <div>{currentPageLabel}</div>,
  ProjectNotFoundView: () => <div>Project not found</div>,
}));

vi.mock("../../../shared/modal", () => ({
  modalApi: { openCreateArtifact: vi.fn(), closeModal: vi.fn() },
  useModalStore: { getState: () => ({ modalType: null, updateModalProps: vi.fn() }) },
}));

const mockUseArtifacts = vi.mocked(useArtifacts);
const mockUseFormSchema = vi.mocked(useFormSchema);
const mockUseListSchema = vi.mocked(useListSchema);
const mockUseOrgMembers = vi.mocked(useOrgMembers);
const mockUseProjectManifest = vi.mocked(useProjectManifest);
const mockUseCreateArtifactCommentMutation = vi.mocked(useCreateArtifactCommentMutation);
const mockUseBacklogWorkspaceProject = vi.mocked(useBacklogWorkspaceProject);

describe("QualityDefectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      permissions: ["artifact:create", "artifact:comment"],
      roles: [],
    });

    mockUseBacklogWorkspaceProject.mockReturnValue({
      orgSlug: "demo-org",
      projectSlug: "demo-project",
      project: { id: "project-1", name: "Demo Project" },
      projectsLoading: false,
    } as never);

    mockUseArtifacts.mockImplementation((...args) => {
      const includeSystemRoots = args[14];
      if (includeSystemRoots) {
        return {
          data: {
            items: [{ id: "root-defect-id", artifact_type: "root-defect" }],
            total: 1,
          },
          isPending: false,
        } as never;
      }
      return {
        data: {
          items: [
            {
              id: "def-1",
              artifact_key: "BUG-1",
              artifact_type: "defect",
              title: "Login fails",
              description: "",
              state: "active",
              assignee_id: "u1",
              custom_fields: {
                severity: "high",
                detected_by: "u1",
                environment: "QA",
              },
              tags: [],
              created_at: null,
              updated_at: "2026-04-01T10:00:00Z",
            },
          ],
          total: 1,
        },
        isLoading: false,
        isFetching: false,
      } as never;
    });

    mockUseProjectManifest.mockReturnValue({
      data: {
        manifest_bundle: {
          artifact_types: [{ id: "defect", fields: [] }],
        },
      },
    } as never);

    mockUseListSchema.mockReturnValue({
      data: {
        entity_type: "artifact",
        columns: [
          { key: "title", label: "Title", order: 1 },
          { key: "severity", label: "Severity", order: 2 },
          { key: "updated_at", label: "Updated", order: 3 },
        ],
      },
    } as never);

    mockUseFormSchema.mockImplementation((...args) => {
      const context = args[3];
      if (context === "edit") {
        return {
          data: {
            entity_type: "artifact",
            context: "edit",
            fields: [
              { key: "title", type: "string", label_key: "Title", editable: true, surfaces: ["tabular"] },
              { key: "severity", type: "choice", label_key: "Severity", options: [{ id: "high", label: "High" }], editable: true, surfaces: ["tabular"] },
              { key: "updated_at", type: "datetime", label_key: "Updated", editable: false, surfaces: ["detail"] },
            ],
          },
          isError: false,
          error: null,
        } as never;
      }
      return {
        data: {
          entity_type: "artifact",
          context: "create",
          fields: [{ key: "title", type: "string", label_key: "Title" }],
        },
        isError: false,
        error: null,
      } as never;
    });

    mockUseOrgMembers.mockReturnValue({
      data: [{ user_id: "u1", display_name: "Ada Lovelace", email: "ada@example.com" }],
    } as never);

    mockUseCreateArtifactCommentMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it("shows classic view by default and expands defect details", async () => {
    renderWithQualityI18n(
      <MemoryRouter initialEntries={["/demo-org/demo-project/quality/defects"]}>
        <Routes>
          <Route path="/:orgSlug/:projectSlug/quality/defects" element={<QualityDefectsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("tab", { name: "Classic view" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tabular view" })).toBeInTheDocument();
    expect(screen.getByText("Login fails")).toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Login fails/i }));

    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Environment")).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) => element?.textContent?.includes("Assignee: Ada Lovelace") ?? false)
        .length,
    ).toBeGreaterThan(0);
  });

  it("renders schema-driven grid columns in tabular view", async () => {
    renderWithQualityI18n(
      <MemoryRouter initialEntries={["/demo-org/demo-project/quality/defects"]}>
        <Routes>
          <Route path="/:orgSlug/:projectSlug/quality/defects" element={<QualityDefectsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole("tab", { name: "Tabular view" }));

    expect(await screen.findByText("Severity")).toBeInTheDocument();
    expect(screen.queryByText("Key")).not.toBeInTheDocument();
    expect(screen.getByText("Login fails")).toBeInTheDocument();
  });
});
