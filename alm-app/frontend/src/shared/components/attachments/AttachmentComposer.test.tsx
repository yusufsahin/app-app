/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentComposer } from "./AttachmentComposer";
import { captureScreenshotFile } from "./useScreenshotCapture";

vi.mock("./useScreenshotCapture", () => ({
  captureScreenshotFile: vi.fn(),
}));

describe("AttachmentComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards accepted files and rejected files separately", () => {
    const onFilesChange = vi.fn();
    const onAddFiles = vi.fn();
    const onFilesRejected = vi.fn();

    render(
      <AttachmentComposer
        files={[]}
        onFilesChange={onFilesChange}
        onAddFiles={onAddFiles}
        onFilesRejected={onFilesRejected}
        labels={{
          addFiles: "Add files",
          captureScreen: "Capture screen",
          clipboardShortcut: "Ctrl+V screenshot",
          removeFile: "Remove file",
        }}
      />,
    );

    const input = screen.getByLabelText("Add files");
    fireEvent.change(input, {
      target: {
        files: [
          new File(["ok"], "shot.png", { type: "image/png" }),
          new File(["bad"], "bad.exe", { type: "application/x-msdownload" }),
        ],
      },
    });

    expect(onFilesChange).toHaveBeenCalledTimes(1);
    expect(onFilesChange).toHaveBeenCalledWith([expect.objectContaining({ name: "shot.png" })]);
    expect(onAddFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "shot.png" })]);
    expect(onFilesRejected).toHaveBeenCalledWith([expect.objectContaining({ name: "bad.exe" })]);
  });

  it("reports successful screenshot capture", async () => {
    vi.mocked(captureScreenshotFile).mockResolvedValueOnce(
      new File(["image"], "capture.png", { type: "image/png" }),
    );
    const onFilesChange = vi.fn();
    const onAddFiles = vi.fn();
    const onCaptureResult = vi.fn();

    render(
      <AttachmentComposer
        files={[]}
        onFilesChange={onFilesChange}
        onAddFiles={onAddFiles}
        onCaptureResult={onCaptureResult}
        labels={{
          addFiles: "Add files",
          captureScreen: "Capture screen",
          clipboardShortcut: "Ctrl+V screenshot",
          removeFile: "Remove file",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Capture screen" }));

    await waitFor(() => {
      expect(onFilesChange).toHaveBeenCalledWith([expect.objectContaining({ name: "capture.png" })]);
      expect(onAddFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "capture.png" })]);
      expect(onCaptureResult).toHaveBeenCalledWith("added");
    });
  });

  it("accepts dropped files and renders image previews for staged files", () => {
    const onFilesChange = vi.fn();
    const onAddFiles = vi.fn();
    const stagedImage = new File(["preview"], "preview.png", { type: "image/png" });

    render(
      <AttachmentComposer
        files={[stagedImage]}
        onFilesChange={onFilesChange}
        onAddFiles={onAddFiles}
        labels={{
          addFiles: "Add files",
          captureScreen: "Capture screen",
          clipboardShortcut: "Ctrl+V screenshot",
          removeFile: "Remove file",
          dropFilesHint: "Drag files here",
          dropFilesActiveHint: "Drop files now",
        }}
      />,
    );

    expect(screen.getByAltText("preview.png")).toBeInTheDocument();

    const dropzone = screen.getByTestId("attachment-composer-dropzone");

    fireEvent.dragEnter(dropzone, {
      dataTransfer: { files: [new File(["drop"], "dropped.png", { type: "image/png" })] },
    });
    expect(screen.getByText("Drop files now")).toBeInTheDocument();

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [new File(["drop"], "dropped.png", { type: "image/png" })] },
    });

    expect(onFilesChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: "preview.png" }),
      expect.objectContaining({ name: "dropped.png" }),
    ]);
    expect(onAddFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "dropped.png" })]);
  });

  it("rejects duplicate files without re-adding them", () => {
    const existing = new File(["same"], "duplicate.png", { type: "image/png" });
    const onFilesChange = vi.fn();
    const onAddFiles = vi.fn();
    const onDuplicateFiles = vi.fn();

    render(
      <AttachmentComposer
        files={[existing]}
        onFilesChange={onFilesChange}
        onAddFiles={onAddFiles}
        onDuplicateFiles={onDuplicateFiles}
        labels={{
          addFiles: "Add files",
          captureScreen: "Capture screen",
          clipboardShortcut: "Ctrl+V screenshot",
          removeFile: "Remove file",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Add files"), {
      target: {
        files: [new File(["same"], "duplicate.png", { type: "image/png" })],
      },
    });

    expect(onDuplicateFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "duplicate.png" })]);
    expect(onFilesChange).not.toHaveBeenCalled();
    expect(onAddFiles).not.toHaveBeenCalled();
  });
});
