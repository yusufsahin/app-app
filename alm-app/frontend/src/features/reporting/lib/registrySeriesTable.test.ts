import { describe, it, expect } from "vitest";
import { registrySeriesTable } from "./registrySeriesTable";

describe("registrySeriesTable", () => {
  it("returns null when series missing or empty", () => {
    expect(registrySeriesTable({})).toBeNull();
    expect(registrySeriesTable({ series: [] })).toBeNull();
  });

  it("returns null when series items are not objects", () => {
    expect(registrySeriesTable({ series: [1, 2] })).toBeNull();
    expect(registrySeriesTable({ series: [[1]] })).toBeNull();
  });

  it("extracts columns and rows from object series", () => {
    const out = registrySeriesTable({
      series: [
        { a: 1, b: "x" },
        { a: 2, b: "y" },
      ],
    });
    expect(out).toEqual({
      columns: ["a", "b"],
      rows: [
        { a: 1, b: "x" },
        { a: 2, b: "y" },
      ],
    });
  });

  it("filters out non-object entries", () => {
    const out = registrySeriesTable({
      series: [{ k: 1 }, null, { k: 2 }, "skip"],
    });
    expect(out?.rows).toEqual([{ k: 1 }, { k: 2 }]);
  });
});
