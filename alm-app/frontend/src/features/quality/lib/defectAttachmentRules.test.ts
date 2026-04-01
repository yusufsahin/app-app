import { describe, it, expect } from "vitest";
import {
  ATTACHMENT_MAX_BYTES,
  extensionAllowedForAttachment,
  isAttachmentFileAllowed,
} from "../../../shared/components/attachments/attachmentRules";

function file(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type });
}

function fileWithMockedSize(name: string, reportedSize: number, type: string): File {
  const f = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(f, "size", { value: reportedSize, configurable: true });
  return f;
}

describe("extensionAllowedForAttachment", () => {
  it("allows listed extensions case-insensitively", () => {
    expect(extensionAllowedForAttachment("shot.PNG")).toBe(true);
    expect(extensionAllowedForAttachment("doc.PDF")).toBe(true);
    expect(extensionAllowedForAttachment("a.JPEG")).toBe(true);
  });

  it("rejects unknown extensions", () => {
    expect(extensionAllowedForAttachment("evil.exe")).toBe(false);
    expect(extensionAllowedForAttachment("x.txt")).toBe(false);
    expect(extensionAllowedForAttachment("noext")).toBe(false);
  });
});

describe("isAttachmentFileAllowed", () => {
  it("allows image and pdf MIME types under max size", () => {
    expect(isAttachmentFileAllowed(file("a.png", 100, "image/png"))).toBe(true);
    expect(isAttachmentFileAllowed(file("b.jpg", 1, "image/jpeg"))).toBe(true);
    expect(isAttachmentFileAllowed(file("c.pdf", 50, "application/pdf"))).toBe(true);
  });

  it("rejects oversize files", () => {
    const big = fileWithMockedSize("huge.png", ATTACHMENT_MAX_BYTES + 1, "image/png");
    expect(isAttachmentFileAllowed(big)).toBe(false);
  });

  it("allows empty or octet-stream type when extension is allowed", () => {
    expect(isAttachmentFileAllowed(file("p.png", 10, ""))).toBe(true);
    expect(isAttachmentFileAllowed(file("p.pdf", 10, "application/octet-stream"))).toBe(true);
  });

  it("rejects empty type with bad extension", () => {
    expect(isAttachmentFileAllowed(file("z.exe", 10, ""))).toBe(false);
  });

  it("rejects disallowed MIME even if name looks ok", () => {
    expect(isAttachmentFileAllowed(file("fake.png", 10, "application/x-msdownload"))).toBe(false);
  });
});
