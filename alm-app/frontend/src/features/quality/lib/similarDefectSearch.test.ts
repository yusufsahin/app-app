import { describe, expect, it } from "vitest";
import { buildSimilarDefectSearchQuery } from "./similarDefectSearch";

describe("buildSimilarDefectSearchQuery", () => {
  it("uses significant words", () => {
    expect(buildSimilarDefectSearchQuery("Login fails on Safari iOS")).toContain("Login");
  });

  it("falls back to title slice when no words", () => {
    expect(buildSimilarDefectSearchQuery("ab")).toBe("ab");
  });
});
