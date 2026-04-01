/** @vitest-environment jsdom */

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "../../../shared/components/ui";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { ArtifactDetailAttachments } from "./ArtifactDetailAttachments";

describe("ArtifactDetailAttachments", () => {
  it("renders translated attachment actions and forwards uploads", () => {
    const onUpload = vi.fn();

    renderWithQualityI18n(
      <Tabs value="attachments">
        <ArtifactDetailAttachments
          attachments={[
            {
              id: "att-1",
              project_id: "proj-1",
              artifact_id: "art-1",
              file_name: "evidence.png",
              content_type: "image/png",
              size: 2048,
              created_by: null,
              created_at: null,
            },
          ]}
          attachmentsLoading={false}
          onDownload={vi.fn()}
          onDelete={vi.fn()}
          onUpload={onUpload}
        />
      </Tabs>,
    );

    expect(screen.getByText("Attachments")).toBeInTheDocument();
    expect(screen.getByText("Upload file")).toBeInTheDocument();
    expect(screen.getByText("Capture screen")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+V screenshot")).toBeInTheDocument();
    expect(screen.getByText("evidence.png")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Upload file"), {
      target: {
        files: [new File(["img"], "shot.png", { type: "image/png" })],
      },
    });

    expect(onUpload).toHaveBeenCalledWith([expect.objectContaining({ name: "shot.png" })]);
  });
});
