/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, screen } from "@testing-library/react";
import { SuiteTestLinkModal } from "./SuiteTestLinkModal";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { useArtifacts } from "../../../shared/api/artifactApi";
import {
  useArtifactLinks,
  useBulkCreateArtifactLinks,
  useBulkDeleteArtifactLinks,
} from "../../../shared/api/artifactLinkApi";

vi.mock("../../../shared/api/artifactApi", () => ({
  useArtifacts: vi.fn(),
}));

vi.mock("../../../shared/api/artifactLinkApi", () => ({
  useArtifactLinks: vi.fn(),
  useBulkCreateArtifactLinks: vi.fn(),
  useBulkDeleteArtifactLinks: vi.fn(),
}));

vi.mock("../../../shared/stores/notificationStore", () => ({
  useNotificationStore: (selector: (state: { showNotification: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ showNotification: vi.fn() }),
}));

const mockUseArtifacts = vi.mocked(useArtifacts);
const mockUseArtifactLinks = vi.mocked(useArtifactLinks);
const mockUseBulkCreate = vi.mocked(useBulkCreateArtifactLinks);
const mockUseBulkDelete = vi.mocked(useBulkDeleteArtifactLinks);

const bulkCreateSpy = vi.fn();
const bulkDeleteSpy = vi.fn();

describe("SuiteTestLinkModal", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "uuid-test" });

    mockUseArtifacts.mockImplementation((...args: unknown[]) => {
      const typeFilter = args[3] as string | undefined;
      if (typeFilter === "test-case") {
        return {
          data: {
            items: [
              { id: "tc-1", title: "API contract case", artifact_type: "test-case" },
              { id: "tc-2", title: "Login case", artifact_type: "test-case" },
            ],
          },
        } as never;
      }
      return {
        data: {
          items: [
            { id: "root-quality", title: "Quality", artifact_type: "root-quality", parent_id: null },
            { id: "f-1", title: "Sprint 1", artifact_type: "quality-folder", parent_id: "root-quality" },
            { id: "tc-1", title: "API contract case", artifact_type: "test-case", parent_id: "f-1" },
            { id: "tc-2", title: "Login case", artifact_type: "test-case", parent_id: "f-1" },
          ],
        },
      } as never;
    });

    mockUseArtifactLinks.mockReturnValue({
      data: [
        {
          id: "link-1",
          from_artifact_id: "suite-1",
          to_artifact_id: "tc-1",
          link_type: "suite_includes_test",
        },
      ],
    } as never);

    bulkCreateSpy.mockResolvedValue({ succeeded: ["tc-2"], failed: [] });
    bulkDeleteSpy.mockResolvedValue({ succeeded: ["link-1"], failed: [] });

    mockUseBulkCreate.mockReturnValue({ isPending: false, mutateAsync: bulkCreateSpy } as never);
    mockUseBulkDelete.mockReturnValue({ isPending: false, mutateAsync: bulkDeleteSpy } as never);
  });

  it("shows in-suite state for previously added testcase", () => {
    renderWithQualityI18n(
      <SuiteTestLinkModal
        open
        onClose={vi.fn()}
        orgSlug="demo"
        projectId="project-1"
        suiteArtifactId="suite-1"
        linkType="suite_includes_test"
        manifestBundle={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "Add tests from Catalog" })).toBeInTheDocument();
    expect(screen.getAllByText("In suite").length).toBeGreaterThan(0);
    expect(screen.getByTestId("suite-link-add-selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from suite" })).toBeInTheDocument();
  });

  it("bulk adds selected non-linked testcases", async () => {
    const user = userEvent.setup();
    renderWithQualityI18n(
      <SuiteTestLinkModal
        open
        onClose={vi.fn()}
        orgSlug="demo"
        projectId="project-1"
        suiteArtifactId="suite-1"
        linkType="suite_includes_test"
        manifestBundle={null}
      />,
    );

    const loginCaseCheckbox = screen.getAllByLabelText("Select Login case").at(0);
    expect(loginCaseCheckbox).toBeDefined();
    await user.click(loginCaseCheckbox!);
    await user.click(screen.getByTestId("suite-link-add-selected"));

    expect(bulkCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to_artifact_ids: ["tc-2"],
        link_type: "suite_includes_test",
      }),
    );
  });

  it("dock presentation renders catalog side panel", () => {
    renderWithQualityI18n(
      <SuiteTestLinkModal
        open
        onClose={vi.fn()}
        orgSlug="demo"
        projectId="project-1"
        suiteArtifactId="suite-1"
        linkType="suite_includes_test"
        manifestBundle={null}
        presentation="dock"
      />,
    );

    expect(screen.getByTestId("quality-suite-catalog-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add tests from Catalog" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("add all in scope bulk-adds non-linked cases in folder scope without confirm", async () => {
    const user = userEvent.setup();
    renderWithQualityI18n(
      <SuiteTestLinkModal
        open
        onClose={vi.fn()}
        orgSlug="demo"
        projectId="project-1"
        suiteArtifactId="suite-1"
        linkType="suite_includes_test"
        manifestBundle={null}
      />,
    );

    await user.click(screen.getByTestId("suite-link-scope-folder"));
    await user.click(screen.getByRole("button", { name: "Sprint 1" }));
    await user.click(screen.getByTestId("suite-link-add-all-in-scope"));

    expect(bulkCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to_artifact_ids: ["tc-2"],
        link_type: "suite_includes_test",
      }),
    );
  });

  it("add all in scope prompts before adding entire catalog", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithQualityI18n(
      <SuiteTestLinkModal
        open
        onClose={vi.fn()}
        orgSlug="demo"
        projectId="project-1"
        suiteArtifactId="suite-1"
        linkType="suite_includes_test"
        manifestBundle={null}
      />,
    );

    await user.click(screen.getByTestId("suite-link-add-all-in-scope"));

    expect(confirmSpy).toHaveBeenCalled();
    expect(bulkCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to_artifact_ids: ["tc-2"],
        link_type: "suite_includes_test",
      }),
    );
    confirmSpy.mockRestore();
  });

  it("bulk removes selected linked testcases", async () => {
    const user = userEvent.setup();
    renderWithQualityI18n(
      <SuiteTestLinkModal
        open
        onClose={vi.fn()}
        orgSlug="demo"
        projectId="project-1"
        suiteArtifactId="suite-1"
        linkType="suite_includes_test"
        manifestBundle={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Select all in suite" }));
    await user.click(screen.getByRole("button", { name: "Remove from suite" }));
    await user.click(screen.getByRole("button", { name: "Confirm remove" }));

    expect(bulkDeleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        link_ids: ["link-1"],
      }),
    );
  });
});
