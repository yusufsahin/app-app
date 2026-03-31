import { describe, expect, it } from "vitest";
import { formatDateTime } from "./formatDateTime";

describe("formatDateTime", () => {
  it("returns empty for nullish", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
  });

  it("formats valid ISO string", () => {
    const s = formatDateTime("2020-06-15T12:30:00.000Z");
    expect(s.length).toBeGreaterThan(0);
  });
});
