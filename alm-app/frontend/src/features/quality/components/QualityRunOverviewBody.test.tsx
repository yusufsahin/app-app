/** @vitest-environment jsdom */
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { MemoryRouter } from "react-router-dom";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { QualityRunOverviewBody } from "./QualityRunOverviewBody";
import { useArtifactRelationships } from "../../../shared/api/relationshipApi";
import { downloadAttachmentBlob, useAttachments } from "../../../shared/api/attachmentApi";
import { useEntityHistory } from "../../../shared/api/auditApi";

vi.mock("../../../shared/api/relationshipApi", () => ({
  useArtifactRelationships: vi.fn(),
}));

vi.mock("../../../shared/api/attachmentApi", () => ({
  useAttachments: vi.fn(),
  downloadAttachmentBlob: vi.fn(),
}));

vi.mock("../../../shared/api/auditApi", () => ({
  useEntityHistory: vi.fn(),
}));

vi.mock("./RunPreviousCompareSection", () => ({
  RunPreviousCompareSection: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockUseArtifactRelationships = vi.mocked(useArtifactRelationships);
const mockUseAttachments = vi.mocked(useAttachments);
const mockUseEntityHistory = vi.mocked(useEntityHistory);
const mockDownloadAttachmentBlob = vi.mocked(downloadAttachmentBlob);
const mockToastError = vi.mocked(toast.error);
const mockToastSuccess = vi.mocked(toast.success);

describe("QualityRunOverviewBody", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockUseArtifactRelationships.mockReturnValue({ data: [], isPending: false, isError: false } as never);
    mockUseAttachments.mockReturnValue({
      data: [
        {
          id: "att-1",
          project_id: "project-1",
          artifact_id: "run-1",
          file_name: "failure.png",
          content_type: "image/png",
          size: 1234,
          created_by: "user-1",
          created_at: "2026-04-01T10:05:00Z",
        },
      ],
      isPending: false,
      isError: false,
    } as never);
    mockUseEntityHistory.mockReturnValue({
      data: {
        entity_type: "artifact",
        entity_id: "run-1",
        total_versions: 1,
        entries: [
          {
            snapshot: {
              id: "snap-1",
              commit_id: "commit-1",
              global_id: "artifact/run-1",
              entity_type: "artifact",
              entity_id: "run-1",
              change_type: "UPDATE",
              state: {},
              changed_properties: ["state"],
              version: 2,
              committed_at: "2026-04-01T10:00:00Z",
              author_id: "user-1",
            },
            changes: [{ property_name: "state", left: "queued", right: "completed" }],
          },
        ],
      },
      isPending: false,
      isError: false,
    } as never);
    mockDownloadAttachmentBlob.mockResolvedValue(
      new Blob(["fake-binary-image"], { type: "image/png" }),
    );
  });

  it("exports run history from the history tab", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:history");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {},
        } as never}
        runArtifactId="run-1"
        overviewTab="history"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export history CSV" }));

    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("exports a combined run package from the summary tab", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    let bundleBlob: Blob | undefined;
    let resolveAttachmentDownload: ((blob: Blob) => void) | undefined;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      bundleBlob = blob as Blob;
      return "blob:bundle";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    mockDownloadAttachmentBlob.mockImplementation(
      () =>
        new Promise<Blob>((resolve) => {
          resolveAttachmentDownload = resolve;
        }),
    );

    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {
            run_metrics_json: JSON.stringify({
              v: 2,
              results: [
                {
                  testId: "tc-1",
                  status: "failed",
                  configurationId: "cfg-1",
                  configurationName: "QA",
                  resolvedValues: {
                    browser: "chromium",
                  },
                  stepResults: [
                    {
                      stepId: "step-1",
                      status: "failed",
                      actualResult: "Login failed",
                      notes: "Observed error",
                      linkedDefectIds: ["BUG-1"],
                      attachmentIds: ["att-1"],
                      expectedResultSnapshot: "Dashboard opens",
                      stepNameSnapshot: "Submit login",
                      stepNumber: 1,
                    },
                  ],
                },
              ],
            }),
          },
        } as never}
        runArtifactId="run-1"
        overviewTab="summary"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export full package ZIP" }));

    expect(screen.getByRole("button", { name: "Downloading attachment 1/1..." })).toBeDisabled();

    expect(resolveAttachmentDownload).toBeDefined();
    resolveAttachmentDownload!(new Blob(["fake-binary-image"], { type: "image/png" }));

    await waitFor(() => {
      expect(click).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    expect(screen.getByRole("button", { name: "Export full package ZIP" })).toBeEnabled();

    expect(bundleBlob).toBeDefined();
    const zip = await JSZip.loadAsync(bundleBlob!);
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "attachments/failure.png",
        "run-history-RUN-1.csv",
        "run-steps-RUN-1.csv",
        "run-parameters-RUN-1.csv",
        "run-attachments-RUN-1.csv",
      ]),
    );

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(manifest.export_type).toBe("quality_run_dossier");
    expect(manifest.run.artifact_key).toBe("RUN-1");
    expect(manifest.counts.attachments).toBe(1);
    expect(manifest.files).toEqual(
      expect.arrayContaining([
        "run-history-RUN-1.csv",
        "run-steps-RUN-1.csv",
        "run-parameters-RUN-1.csv",
        "run-attachments-RUN-1.csv",
      ]),
    );
    expect(manifest.attachment_files).toEqual(["attachments/failure.png"]);
    expect(mockDownloadAttachmentBlob).toHaveBeenCalledWith("demo-org", "project-1", "run-1", "att-1");

    const attachmentsCsv = await zip.file("run-attachments-RUN-1.csv")!.async("string");
    expect(attachmentsCsv).toContain("failure.png");
    expect(attachmentsCsv).toContain("att-1");

    const attachmentBinary = await zip.file("attachments/failure.png")!.async("string");
    expect(attachmentBinary).toBe("fake-binary-image");
  });

  it("exports run step results from the steps tab", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:steps");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {
            run_metrics_json: JSON.stringify({
              v: 2,
              results: [
                {
                  testId: "tc-1",
                  status: "failed",
                  configurationName: "QA",
                  stepResults: [
                    {
                      stepId: "step-1",
                      status: "failed",
                      actualResult: "Login failed",
                      notes: "Observed error",
                      linkedDefectIds: ["BUG-1"],
                      attachmentIds: ["att-1"],
                      expectedResultSnapshot: "Dashboard opens",
                      stepNameSnapshot: "Submit login",
                      stepNumber: 1,
                    },
                  ],
                },
              ],
            }),
          },
        } as never}
        runArtifactId="run-1"
        overviewTab="steps"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export steps CSV" }));

    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("renders linked artifacts on the linked tab", () => {
    mockUseArtifactRelationships.mockReturnValue({
      data: [
        {
          id: "rel-1",
          relationship_type: "run_for_suite",
          display_label: "Run For Suite",
          other_artifact_id: "artifact-12345678",
          other_artifact_key: null,
        },
      ],
      isPending: false,
      isError: false,
    } as never);

    renderWithQualityI18n(
      <MemoryRouter>
        <QualityRunOverviewBody
          orgSlug="demo-org"
          projectSlug="demo-project"
          projectId="project-1"
          run={{
            id: "run-1",
            artifact_key: "RUN-1",
            title: "Run 1",
            description: "",
            state: "completed",
            custom_fields: {},
          } as never}
          runArtifactId="run-1"
          overviewTab="linked"
          onOverviewTabChange={vi.fn()}
          onOpenExecution={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Run for suite")).toBeInTheDocument();
    expect(screen.getByTitle("artifact-12345678")).toBeInTheDocument();
  });

  it("downloads an attachment from the attachments tab", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:attachment");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {
            run_metrics_json: JSON.stringify({
              v: 2,
              results: [
                {
                  testId: "tc-1",
                  status: "failed",
                  stepResults: [
                    {
                      stepId: "step-1",
                      status: "failed",
                      attachmentIds: ["att-1"],
                      stepNumber: 1,
                    },
                  ],
                },
              ],
            }),
          },
        } as never}
        runArtifactId="run-1"
        overviewTab="attachments"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    expect(screen.getByText("Referenced by step(s): 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(mockDownloadAttachmentBlob).toHaveBeenCalledWith("demo-org", "project-1", "run-1", "att-1");
    expect(click).toHaveBeenCalled();
  });

  it("shows an error toast when dossier export fails", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:bundle");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(JSZip.prototype, "generateAsync").mockRejectedValue(new Error("ZIP generation failed"));

    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {
            run_metrics_json: JSON.stringify({
              v: 2,
              results: [
                {
                  testId: "tc-1",
                  status: "failed",
                  stepResults: [
                    {
                      stepId: "step-1",
                      status: "failed",
                      attachmentIds: ["att-1"],
                    },
                  ],
                },
              ],
            }),
          },
        } as never}
        runArtifactId="run-1"
        overviewTab="summary"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export full package ZIP" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("ZIP generation failed");
    });
    expect(screen.getByRole("button", { name: "Export full package ZIP" })).toBeEnabled();
    expect(click).not.toHaveBeenCalled();
  });

  it("exports dossier zip with failure report when an attachment download fails", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    let bundleBlob: Blob | undefined;
    const originalCreateElement = document.createElement.bind(document);
    mockUseAttachments.mockReturnValue({
      data: [
        {
          id: "att-1",
          project_id: "project-1",
          artifact_id: "run-1",
          file_name: "failure.png",
          content_type: "image/png",
          size: 1234,
          created_by: "user-1",
          created_at: "2026-04-01T10:05:00Z",
        },
        {
          id: "att-2",
          project_id: "project-1",
          artifact_id: "run-1",
          file_name: "trace.log",
          content_type: "text/plain",
          size: 456,
          created_by: "user-1",
          created_at: "2026-04-01T10:06:00Z",
        },
      ],
      isPending: false,
      isError: false,
    } as never);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      bundleBlob = blob as Blob;
      return "blob:bundle";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    mockDownloadAttachmentBlob.mockImplementation(async (_org, _project, _artifact, attachmentId) => {
      if (attachmentId === "att-1") {
        return new Blob(["good-image"], { type: "image/png" });
      }
      throw new Error("Trace download failed");
    });

    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {
            run_metrics_json: JSON.stringify({
              v: 2,
              results: [
                {
                  testId: "tc-1",
                  status: "failed",
                  stepResults: [
                    {
                      stepId: "step-1",
                      status: "failed",
                      attachmentIds: ["att-1", "att-2"],
                    },
                  ],
                },
              ],
            }),
          },
        } as never}
        runArtifactId="run-1"
        overviewTab="summary"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export full package ZIP" }));

    await waitFor(() => {
      expect(click).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Exported dossier ZIP with 1 attachment failure(s).");
    });

    expect(bundleBlob).toBeDefined();
    const zip = await JSZip.loadAsync(bundleBlob!);
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        "attachments/failure.png",
        "attachment-failures.csv",
        "manifest.json",
      ]),
    );
    expect(zip.file("attachments/trace.log")).toBeNull();

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(manifest.attachment_files).toEqual(["attachments/failure.png"]);
    expect(manifest.failed_attachments).toEqual([
      {
        attachmentId: "att-2",
        fileName: "trace.log",
        error: "Trace download failed",
      },
    ]);

    const failureReport = await zip.file("attachment-failures.csv")!.async("string");
    expect(failureReport).toContain("att-2");
    expect(failureReport).toContain("trace.log");
    expect(failureReport).toContain("Trace download failed");
  });

  it("renders expanded steps when step results are absent", () => {
    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {
            run_metrics_json: JSON.stringify({
              v: 2,
              results: [
                {
                  testId: "tc-1",
                  status: "passed",
                  expandedStepsSnapshot: [
                    {
                      id: "step-1",
                      stepNumber: 1,
                      name: "Open page",
                      description: "",
                      expectedResult: "Page opens",
                      status: "passed",
                    },
                  ],
                  stepResults: [],
                },
              ],
            }),
          },
        } as never}
        runArtifactId="run-1"
        overviewTab="steps"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    expect(screen.getByText("Open page")).toBeInTheDocument();
    expect(screen.getByText("Page opens")).toBeInTheDocument();
  });

  it("exports run parameters from the parameters tab", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === "a") {
        return { click } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:params");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {
            run_metrics_json: JSON.stringify({
              v: 2,
              results: [
                {
                  testId: "tc-1",
                  status: "passed",
                  configurationId: "cfg-1",
                  configurationName: "QA",
                  resolvedValues: {
                    browser: "chromium",
                    env: "qa",
                  },
                  stepResults: [],
                },
              ],
            }),
          },
        } as never}
        runArtifactId="run-1"
        overviewTab="parameters"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export parameters CSV" }));

    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("shows an empty state when no parameters are stored", () => {
    renderWithQualityI18n(
      <QualityRunOverviewBody
        orgSlug="demo-org"
        projectSlug="demo-project"
        projectId="project-1"
        run={{
          id: "run-1",
          artifact_key: "RUN-1",
          title: "Run 1",
          description: "",
          state: "completed",
          custom_fields: {
            run_metrics_json: JSON.stringify({
              v: 2,
              results: [
                {
                  testId: "tc-1",
                  status: "passed",
                  stepResults: [],
                },
              ],
            }),
          },
        } as never}
        runArtifactId="run-1"
        overviewTab="parameters"
        onOverviewTabChange={vi.fn()}
        onOpenExecution={vi.fn()}
      />,
    );

    expect(screen.getByText("No parameter values were stored on this run.")).toBeInTheDocument();
  });
});
