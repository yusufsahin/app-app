import { describe, it, expect } from "vitest";
import { buildReportCsvContent } from "./downloadReportCsv";

describe("buildReportCsvContent", () => {
  it("prefixes UTF-8 BOM", () => {
    const csv = buildReportCsvContent(["a"], [{ a: 1 }]);
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv.includes("a")).toBe(true);
  });

  it("escapes quotes and commas", () => {
    const csv = buildReportCsvContent(["x"], [{ x: 'say "hi", ok' }]);
    expect(csv).toContain('""');
  });
});
