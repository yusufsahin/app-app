import { describe, it, expect } from "vitest";
import {
  DEFECT_ATTACHMENT_MAX_BYTES,
  extensionAllowedForDefectAttachment,
  isDefectAttachmentFileAllowed,
} from "./defectAttachmentRules";

function file(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type });
}

function fileWithMockedSize(name: string, reportedSize: number, type: string): File {
  const f = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(f, "size", { value: reportedSize, configurable: true });
  return f;
}

describe("extensionAllowedForDefectAttachment", () => {
  it("allows listed extensions case-insensitively", () => {
    expect(extensionAllowedForDefectAttachment("shot.PNG")).toBe(true);
    expect(extensionAllowedForDefectAttachment("doc.PDF")).toBe(true);
    expect(extensionAllowedForDefectAttachment("a.JPEG")).toBe(true);
  });

  it("rejects unknown extensions", () => {
    expect(extensionAllowedForDefectAttachment("evil.exe")).toBe(false);
    expect(extensionAllowedForDefectAttachment("x.txt")).toBe(false);
    expect(extensionAllowedForDefectAttachment("noext")).toBe(false);
  });
});

describe("isDefectAttachmentFileAllowed", () => {
  it("allows image and pdf MIME types under max size", () => {
    expect(isDefectAttachmentFileAllowed(file("a.png", 100, "image/png"))).toBe(true);
    expect(isDefectAttachmentFileAllowed(file("b.jpg", 1, "image/jpeg"))).toBe(true);
    expect(isDefectAttachmentFileAllowed(file("c.pdf", 50, "application/pdf"))).toBe(true);
  });

  it("rejects oversize files", () => {
    const big = fileWithMockedSize("huge.png", DEFECT_ATTACHMENT_MAX_BYTES + 1, "image/png");
    expect(isDefectAttachmentFileAllowed(big)).toBe(false);
  });

  it("allows empty or octet-stream type when extension is allowed", () => {
    expect(isDefectAttachmentFileAllowed(file("p.png", 10, ""))).toBe(true);
    expect(isDefectAttachmentFileAllowed(file("p.pdf", 10, "application/octet-stream"))).toBe(true);
  });

  it("rejects empty type with bad extension", () => {
    expect(isDefectAttachmentFileAllowed(file("z.exe", 10, ""))).toBe(false);
  });

  it("rejects disallowed MIME even if name looks ok", () => {
    expect(isDefectAttachmentFileAllowed(file("fake.png", 10, "application/x-msdownload"))).toBe(false);
  });
});
